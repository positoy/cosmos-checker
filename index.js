const https = require("https");
const crypto = require("crypto");
const axios = require("axios");

const args = {};
process.argv.slice(2).forEach((val) => {
  const sp = val.split("=");
  args[sp[0]] = sp[1];
});
console.log(args);

const WEEKDAY = {
  0: "(일)",
  1: "(월)",
  2: "(화)",
  3: "(수)",
  4: "(목)",
  5: "(금)",
  6: "(토)",
};

const reservationUrl =
  "https://api.hpms.onda.me/be/properties/healinigstaykosmos/bookings/search?checkin=2021-11-01&checkout=2021-11-30&locale=ko-KR";

const bestDates = [
  "2021-11-01",
  "2021-11-02",
  "2021-11-03",
  "2021-11-04",
  "2021-11-05",
  "2021-11-06",
  "2021-11-07",
  "2021-11-08",
  "2021-11-09",
  "2021-11-10",
  "2021-11-11",
  "2021-11-12",
  "2021-11-13",
  "2021-11-14",
  "2021-11-15",
  "2021-11-16",
  "2021-11-17",
  "2021-11-22",
  "2021-11-23",
];

const phoneNumbers = args.phoneNumbers.split(",");

const ncp = {
  ncpAccessKey: args.ncpAccessKey,
  ncpSecretKey: args.ncpSecretKey,
  smsServiceId: args.smsServiceId,
  smsSecretKey: args.smsSecretKey,
  host: "https://sens.apigw.ntruss.com",
  smsUrl: `/sms/v2/services/${args.smsServiceId}/messages`,
};

const evaluateRoomType = (roomtype) => {
  const { name, available_dates } = roomtype;
  const availableDates = available_dates.filter((date) => date.available);
  const isAvailable = availableDates.length !== 0;

  return {
    name,
    isAvailable,
    availableDates,
  };
};

/*
 * 1. 트윈, 온돌, 패밀리
 * 11/1, 11/2, ...
 * https://api.hpms.onda.me/be/properties/healinigstaykosmos/bookings/search?checkin=2021-11-01&checkout=2021-11-30&locale=ko-KR
 */

const getRoomName = (name) => {
  if (name.includes("트윈")) return "트윈";
  if (name.includes("온돌")) return "온돌";
  if (name.includes("패밀리")) return "패밀리";
  return "알수없음";
};

const getReport = (typeResult) => {
  let chanceOccured = false;

  let roomSummary = "";
  typeResult.forEach((result, index) => {
    roomSummary += `${index + 1}. ${getRoomName(result.name)}`;
    roomSummary +=
      result.availableDates.length === 0
        ? "\n\n"
        : `${result.availableDates
            .map((date) => {
              const lovely =
                bestDates.filter((bestDate) => bestDate === date.date)
                  .length !== 0;
              if (lovely) chanceOccured = true;

              const [y, m, d] = date.date
                .split("-")
                .map((value) => Number.parseInt(value));

              return `\n - ${m}/${d} ${
                WEEKDAY[new Date(y, m - 1, d).getDay()]
              } ${lovely ? "좋아" : ""}`;
            })
            .toString()}\n\n`;
  });

  return {
    report: chanceOccured,
    content: roomSummary,
  };
};

const sendSMS = (content, phoneNumbers) => {
  const timestamp = new Date().getTime().toString();
  const headers = {
    "x-ncp-apigw-timestamp": timestamp,
    "x-ncp-iam-access-key": ncp.ncpAccessKey,
    "x-ncp-apigw-signature-v2": crypto
      .createHmac("sha256", ncp.ncpSecretKey)
      .update(`POST ${ncp.smsUrl}\n${timestamp}\n${ncp.ncpAccessKey}`)
      .digest("base64"),
  };

  const data = {
    type: "SMS",
    contentType: "COMM",
    countryCode: "82",
    from: "01099272703",
    content: "hellow",
    messages: phoneNumbers.map((number) => ({
      to: number,
      content,
    })),
  };

  console.log(data);
  axios
    .post(ncp.host + ncp.smsUrl, data, { headers })
    .then((res) => {
      console.log(`statusCode: ${res.status}`);
      console.log(res);
    })
    .catch((error) => {
      console.error(error);
    });
};

const doBatch = (forceReport) => {
  const req = https.get(reservationUrl, (res) => {
    var body = "";

    res.on("data", (data) => {
      body += data;
    });

    res.on("end", () => {
      const evaluatedRooms = JSON.parse(body).roomtypes.map(evaluateRoomType);
      const result = getReport(evaluatedRooms);
      console.log(result);

      if (forceReport || result.report) {
        sendSMS(result.content, phoneNumbers);
      }
    });
  });

  req.on("error", (e) => {
    console.error(e);
  });
};

console.log("------------------------------");
console.log(new Date());

const forceReport =
  new Date().getHours() === 0 && new Date().getMinutes() === 0;

doBatch(true);

