const axios = require("axios");
const fs = require("fs");
const iconv = require("iconv-lite"); // iconv-liteパッケージを使用してShiftJISを扱う
const { parse } = require("csv-parse/sync");
const winston = require("winston");
const path = require("path");
const { table } = require("console");

const isDebugMode = true;

// ログの設定
const logger = winston.createLogger({
  level: isDebugMode ? "debug" : "info", // デバッグモードに応じてログレベルを設定
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(__dirname, "app.log"),
      level: "info", // info以上のレベルを記録
    }),
    new winston.transports.File({
      filename: path.join(__dirname, "debug.log"),
      level: isDebugMode ? "debug" : "silent", // デバッグモードに応じて出力
    }),
  ],
});

//src_moneyの中のtxtファイルを読み込み、値を取得
class LatchCsvReader {
  constructor() {}

  findTxtFile(directoryPath) {
    const files = fs.readdirSync(directoryPath);
    const txtFileRegex = /\.txt$/i;
    for (const file of files) {
      if (txtFileRegex.test(file)) {
        return path.join(directoryPath, file);
      }
    }
    throw new Error("No txt or TXT file found in the directory");
  }

  csvReader() {
    const directoryPath = path.join(__dirname, "src_money");
    const filePath = this.findTxtFile(directoryPath);

    // ShiftJISでファイルを読み込む
    const fileBuffer = fs.readFileSync(filePath);
    const fileContent = iconv.decode(fileBuffer, "Shift_JIS");

    // CSVをパースする
    const records = parse(fileContent, {
      columns: true, // ヘッダーがある場合はtrueにする
      delimiter: ",", // デフォルトのカンマ区切りを設定する
      skip_empty_lines: true, // 空行をスキップする場合
    });

    const filteredRecords = records.map((record) => ({
      加入者コード: record["加入者コード"],
      企業事業所コード: record["企業事業所コード"],
      企業事業所名: record["企業事業所名"],
      社員コード: record["社員コード"],
      資格喪失年齢到達予定日: record["資格喪失年齢到達予定日"],
      資格取得日: record["資格取得日"],
      資格喪失日: record["資格喪失日"],
      拠出限度額区分: record["拠出限度額区分"],
      定時拠出金額: record["定時拠出金額"],
      休止: record["休止"],
      拠出限度額区分: record["拠出限度額区分"],
      事業主掛金: record["事業主掛金"],
    }));

    return filteredRecords;
  }
}

//src_informの中のtxtファイルを読み込み、値を取得
class InformCsvReader {
  constructor() {}

  findTxtFile(directoryPath) {
    const files = fs.readdirSync(directoryPath);
    const txtFileRegex = /\.txt$/i;
    for (const file of files) {
      if (txtFileRegex.test(file)) {
        return path.join(directoryPath, file);
      }
    }
    throw new Error("No txt or TXT file found in the directory");
  }

  //src_informの中のcsvまたはtxtファイルを読み込み、値を取得
  csvReader() {
    const directoryPath = path.join(__dirname, "src_inform");
    const filePath = this.findTxtFile(directoryPath);

    // ShiftJISでファイルを読み込む
    const fileBuffer = fs.readFileSync(filePath);
    const fileContent = iconv.decode(fileBuffer, "Shift_JIS");

    // CSVをパースする
    const records = parse(fileContent, {
      columns: true, // ヘッダーがある場合はtrueにする
      delimiter: ",", // デフォルトのカンマ区切りを設定する
      skip_empty_lines: true, // 空行をスキップする場合
    });

    const filteredRecords = records.map((record) => ({
      加入者コード: record["加入者ｺｰﾄﾞ"],
      加入者名: record["加入者名(漢字)"],
      加入者メイ: record["加入者名(ｶﾅ)"],
      生年月日: record["生年月日"],
      性別: record["性別"],
      郵便番号: record["郵便番号"],
      住所1: record["住所1(漢字)"],
      住所2: record["住所2(漢字)"],
      住所3: record["住所3(漢字)"],
      基礎年金番号: record["基礎年金番号"],
      入社年月日: record["入社年月日"],
      加入資格取得年月日: record["加入資格取得年月日"],
      拠出開始年月: record["拠出開始年月"],
    }));

    return filteredRecords;
  }
}

//401k_全体管理アプリから加入者コード取得、レコードを追加or更新を行う
class KintoneClient {
  constructor(appId, apiToken, employee401kInfo) {
    this.subdomain = "nkr-group";
    this.apiToken = apiToken;
    this.appId = appId;
    this.employee401kInfo = employee401kInfo;
    this.appInfo = [];
    this.appUpdate = [];
    this.appRegister = [];
    this.appInfoFromCSV = [];
    this.records = [];
    this.query = "limit 500";

    this.url = `https://${this.subdomain}.cybozu.com/k/v1/records.json`;
    this.headers = {
      "X-Cybozu-API-Token": this.apiToken,
    };
    this.paramsSearch = {
      app: this.appId,
      query: this.query,
      fields: ["$id", "加入者コード"],
    };
    this.recordId = null;
  }

  csvToObject() {
    if (this.employee401kInfo.length > 0) {
      for (let l = 0; l < this.employee401kInfo.length; l++) {
        let appInfoFromCSV_1 = {
          _401k加入有無: { value: "有" },
          社員No: { value: this.employee401kInfo[l]["社員コード"] },
          企業事業所コード: {
            value: this.employee401kInfo[l]["企業事業所コード"],
          },
          会社名: { value: this.employee401kInfo[l]["企業事業所名"] },
          加入者コード: { value: this.employee401kInfo[l]["加入者コード"] },
          加入者名: { value: this.employee401kInfo[l]["加入者名"] },
          加入者メイ: { value: this.employee401kInfo[l]["加入者メイ"] },
          性別: { value: this.employee401kInfo[l]["性別"] },
          生年月日: { value: this.employee401kInfo[l]["生年月日"] },
          郵便番号: { value: this.employee401kInfo[l]["郵便番号"] },
          住所１: { value: this.employee401kInfo[l]["住所1"] },
          住所２: { value: this.employee401kInfo[l]["住所2"] },
          住所３: { value: this.employee401kInfo[l]["住所3"] },
          入社年月日: { value: this.employee401kInfo[l]["入社年月日"] },
          基礎年金番号: { value: this.employee401kInfo[l]["基礎年金番号"] },
          現在の拠出額: { value: this.employee401kInfo[l]["定時拠出金額"] },
          休止の有無: { value: this.employee401kInfo[l]["休止"] },
          事業主掛金: { value: this.employee401kInfo[l]["事業主掛金"] },
          資格喪失年齢到達予定日: {
            value: formatDate(
              this.employee401kInfo[l]["資格喪失年齢到達予定日"]
            ),
          },
        };
        if (this.employee401kInfo[l]["資格喪失日"] == "99999999") {
          appInfoFromCSV_1["_401k加入有無"]["value"] = "有";
        } else {
          appInfoFromCSV_1["_401k加入有無"]["value"] = "無";
        }
        this.appInfoFromCSV.push(appInfoFromCSV_1);
      }
    }
  }

  //401k全体管理アプリから全レコードの情報取得
  async getRecords401kApp() {
    //csvデータからデータ作成
    const responseSearch = await axios.get(this.url, {
      headers: this.headers,
      params: this.paramsSearch,
    });

    const records = responseSearch.data.records;
    if (records.length > 0) {
      for (let i = 0; i < records.length; i++) {
        let appInfo_1 = {
          id: records[i].$id.value,
          加入者コード: records[i].加入者コード.value,
        };
        this.appInfo.push(appInfo_1);
      }
      return this.appInfo;
    }
  }

  //401kアプリに送信するデータを作成し、更新
  async updateRecords401kApp() {
    for (let k = 0; k < this.appInfoFromCSV.length; k++) {
      let searchFlag = false;
      for (let m = 0; m < this.appInfo.length; m++) {
        if (
          this.appInfo[m]["加入者コード"] ==
          this.appInfoFromCSV[k]["加入者コード"]["value"]
        ) {
          let appUpdate_1 = {
            id: this.appInfo[m]["id"],
            record: this.appInfoFromCSV[k],
          };
          this.appUpdate.push(appUpdate_1);
          searchFlag = true;
        }
      }
      if (!searchFlag) {
        this.appRegister.push(this.appInfoFromCSV[k]);
      }
    }

    await postRecords(this.url, this.headers, this.appId, this.appRegister);
    await putRecords(
      this.url,
      this.headers,
      this.appId,
      this.recordId,
      this.appUpdate
    );
    logger.info("401k管理アプリ情報登録完了");
  }
}

//連絡キャッチャーから401k全体アプリに転記する
class ContactRecordTranscriber {
  constructor(appId_401k, apiToken_401k, appId_catcher, apiToken_catcher) {
    this.subdomain = "nkr-group";
    this.apiToken_401k = apiToken_401k;
    this.appId_401k = appId_401k;
    this.apiToken_catcher = apiToken_catcher;
    this.appId_catcher = appId_catcher;
    this.query_catcher = 'Status in ("未転記")';
    this.appaddvalue_catcher = [];

    this.url = `https://${this.subdomain}.cybozu.com/k/v1/records.json`;
    this.url_1 = `https://${this.subdomain}.cybozu.com/k/v1/record.json`;
    this.headers_catcher = {
      "X-Cybozu-API-Token": this.apiToken_catcher,
    };
    this.headers_401k = {
      "X-Cybozu-API-Token": this.apiToken_401k,
    };
    this.paramsSearch_catcher = {
      app: this.appId_catcher,
      query: this.query_catcher,
      fields: [
        "$id",
        "基礎年金番号",
        "_401k種別",
        "作成日時",
        "会社レコード番号",
        "本人拠出額_転記",
        "法人拠出額_転記",
        "合計額_転記",
        "プランの種類",
        "資格喪失年齢到達予定日",
      ],
    };
    this.recordId = null;
    this.paramsSearch_401k = null;
  }

  async getRecords401kCatcher() {
    const responseSearch_catcher = await axios.get(this.url, {
      headers: this.headers_catcher,
      params: this.paramsSearch_catcher,
    });
    const records_catcher = responseSearch_catcher.data.records;

    for (let ii = 0; ii < records_catcher.length; ii++) {
      this.query_401k = `基礎年金番号 = "${records_catcher[ii][
        "基礎年金番号"
      ].value.replace(/-/g, "")}"`;
      this.paramsSearch_401k = {
        app: this.appId_401k,
        query: this.query_401k,
        fields: [
          "$id",
          "基礎年金番号",
          "手続履歴",
          "差異フラグ",
          "現在の拠出額",
          "プランの種類",
          "本人拠出額_閲覧用",
          "法人拠出額_閲覧用",
          "合計額_閲覧用",
          "連絡日時_掛金",
        ],
      };

      let responseSearch_401k = await axios.get(this.url, {
        headers: this.headers_401k,
        params: this.paramsSearch_401k,
      });
      const records_401k = responseSearch_401k.data.records;
      if (records_401k[0]) {
        let value_table = [];

        if (records_401k.length > 0) {
          let rireki_table = records_401k[0]["手続履歴"]["value"];
          for (let kk = 0; kk < rireki_table.length; kk++) {
            value_table.push(rireki_table[kk]);
          }
        }
        let value_table_1 = {
          id: "",
          value: {
            連絡日時: { value: records_catcher[ii]["作成日時"].value },
            手続内容: { value: records_catcher[ii]["_401k種別"].value },
          },
        };
        value_table.push(value_table_1);

        let id_value = records_401k[0]["$id"].value;

        let tableaddobj = {
          app: this.appId_401k,
          id: id_value,
          record: {
            会社レコード番号: {
              value: records_catcher[ii]["会社レコード番号"].value,
            },
            手続履歴: {
              value: value_table,
            },
          },
        };
        if (
          records_catcher[ii]["_401k種別"].value == "加入" ||
          records_catcher[ii]["_401k種別"].value == "掛金変更"
        ) {
          tableaddobj.record["本人拠出額"] = {
            value: records_catcher[ii]["本人拠出額_転記"].value,
          };
          tableaddobj.record["法人拠出額"] = {
            value: records_catcher[ii]["法人拠出額_転記"].value,
          };
          tableaddobj.record["合計額"] = {
            value: records_catcher[ii]["合計額_転記"].value,
          };
          tableaddobj.record["プランの種類"] = {
            value: records_catcher[ii]["プランの種類"].value,
          };
          tableaddobj.record["連絡日時_掛金"] = {
            value: records_catcher[ii]["作成日時"].value,
          };
          if (
            records_401k[0]["現在の拠出額"]["value"] ==
            records_catcher[ii]["合計額_転記"].value
          ) {
            tableaddobj.record["差異フラグ"] = {
              value: "無",
            };
            tableaddobj.record["本人拠出額_閲覧用"] = {
              value: records_catcher[ii]["本人拠出額_転記"].value,
            };
            tableaddobj.record["法人拠出額_閲覧用"] = {
              value: records_catcher[ii]["法人拠出額_転記"].value,
            };
            tableaddobj.record["合計額_閲覧用"] = {
              value: records_catcher[ii]["合計額_転記"].value,
            };
          } else {
            tableaddobj.record["差異フラグ"] = {
              value: "有",
            };
          }
        }
        try {
          const responseData_post_401k = await axios.put(
            this.url_1,
            tableaddobj,
            {
              headers: this.headers_401k,
            }
          );

          if (responseData_post_401k.status === 200) {
            let tableaddobj_catcher = {
              app: this.appId_catcher,
              id: records_catcher[ii]["$id"].value,
              record: {
                Status: {
                  value: "転記済",
                },
              },
            };

            const responseData_post_catcher = await axios.put(
              this.url_1,
              tableaddobj_catcher,
              {
                headers: this.headers_catcher,
              }
            );

            logger.info(
              `基礎年金番号: ${records_catcher[ii]["基礎年金番号"].value}; 401k連絡キャッチャー情報転記成功`
            );
          } else {
            logger.info(
              `基礎年金番号: ${records_catcher[ii]["基礎年金番号"].value}; 401k連絡キャッチャーに転記失敗`
            );
          }
        } catch (error) {
          console.error("An error occurred:", error);
        }
      } else {
        logger.info(
          `基礎年金番号: ${records_catcher[ii]["基礎年金番号"].value};`
        );
      }
    }
    logger.info("401k連絡キャッチャー転記完了");
  }
}

//従業員管理アプリ(非顧問先用)に401k加入有無を転記
class KintoneEmployeeAppClient_NonAdvise {
  constructor(
    appId,
    apiToken,
    employee401kInfo,
    appId_catcher,
    apiToken_catcher
  ) {
    this.apiToken_catcher = apiToken_catcher;
    this.appId_catcher = appId_catcher;
    this.subdomain = "nkr-group";
    this.apiToken = apiToken;
    this.appId = appId;
    this.employee401kInfo = employee401kInfo;
    this.appInfo = [];
    this.records = [];

    this.url = `https://${this.subdomain}.cybozu.com/k/v1/records.json`;
    this.url_1 = `https://${this.subdomain}.cybozu.com/k/v1/record.json`;
    this.headers = {
      "X-Cybozu-API-Token": this.apiToken,
    };
    this.headers_catcher = {
      "X-Cybozu-API-Token": this.apiToken_catcher,
    };
    this.recordId = null;
  }

  //従業員管理アプリから全レコードの情報取得
  async getRecords401kApp() {
    let allResults = [];
    let offset = 0;
    let limit = 500;
    let hasMore = true;

    while (hasMore) {
      // Kintone APIのクエリを設定
      this.paramsSearch = {
        app: this.appId,
        query: "limit 500",
        limit: limit, // 取得するレコード数
        offset: offset, // オフセット
      };

      // APIリクエスト
      const responseSearch = await axios.get(this.url, {
        headers: this.headers,
        params: this.paramsSearch,
      });

      // 結果を結合
      allResults = allResults.concat(responseSearch.data.records);

      // 取得したデータの件数を確認
      if (responseSearch.data.records.length === limit) {
        offset += limit; // オフセットを更新
      } else {
        // 取得したデータの件数がlimit未満であれば終了
        hasMore = false;
      }
    }

    const records = allResults;
    if (records.length > 0) {
      for (let i = 0; i < records.length; i++) {
        let appInfo_1 = {
          id: records[i].$id.value,
          基礎年金番号: records[i].基礎年金番号.value,
          セイ戸籍カナ: records[i].セイ戸籍カナ.value,
          メイ戸籍カナ: records[i].メイ戸籍カナ.value,
          生年月日: records[i].生年月日.value,
        };
        this.appInfo.push(appInfo_1);
      }
      return this.appInfo;
    } else {
      // console.log("条件に合うレコードが見つかりませんでした。");
    }
  }

  //csvデータからデータ作成
  async csvToObject() {
    for (let j = 0; j < this.employee401kInfo.length; j++) {
      let searchFlag = false;
      for (let i = 0; i < this.appInfo.length; i++) {
        if (
          this.appInfo[i]["基礎年金番号"].replace(/-/g, "") ==
            this.employee401kInfo[j]["基礎年金番号"] &&
          kanaFullToHalf(
            this.appInfo[i]["セイ戸籍カナ"] +
              "　" +
              this.appInfo[i]["メイ戸籍カナ"]
          ) == this.employee401kInfo[j]["加入者メイ"] &&
          this.appInfo[i]["生年月日"] == this.employee401kInfo[j]["生年月日"]
        ) {
          // console.log();
          searchFlag = true;
          if (this.employee401kInfo[j]["資格喪失日"] == "99999999") {
            this.appInfo[i]["_401k加入有無"] = "有";
          } else {
            this.appInfo[i]["_401k加入有無"] = "無";
          }
          this.query_catcher = `基礎年金番号 = "${this.employee401kInfo[j][
            "基礎年金番号"
          ].slice(0, 4)}-${this.employee401kInfo[j]["基礎年金番号"].slice(
            4
          )}" and Status in ("転記済") and Status2 not in ("完了")`;
          this.paramsSearch_catcher = {
            app: this.appId_catcher,
            query: this.query_catcher,
            fields: ["$id", "Status", "Status2"],
          };
          const responseSearch_catcher = await axios.get(this.url, {
            headers: this.headers_catcher,
            params: this.paramsSearch_catcher,
          });
          const records_catcher = responseSearch_catcher.data.records;
          for (let ii = 0; ii < records_catcher.length; ii++) {
            let tableaddobj_catcher = {
              app: this.appId_catcher,
              id: records_catcher[ii]["$id"].value,
              record: {
                Status2: {
                  value: "完了",
                },
              },
            };
            if (responseSearch_catcher.data.records.length > 0) {
              let record_content = {
                app: this.appId,
                id: this.appInfo[i]["id"],
                record: {
                  _401k加入有無: {
                    value: this.appInfo[i]["_401k加入有無"],
                  },
                },
              };
              const response = await axios.put(this.url_1, record_content, {
                headers: this.headers,
              });
              if (response.status === 200) {
                const responseData_post_catcher = await axios.put(
                  this.url_1,
                  tableaddobj_catcher,
                  {
                    headers: this.headers_catcher,
                  }
                );
                logger.info(
                  `会社名:${this.employee401kInfo[j]["企業事業所名"]}; 基礎年金番号:${this.employee401kInfo[j]["基礎年金番号"]}; 転記完了しました`
                );
              } else {
                logger.info(
                  `会社名:${this.employee401kInfo[j]["企業事業所名"]}; 加入者メイ(半角):${this.employee401kInfo[j]["加入者メイ"]}; 基礎年金番号:${this.employee401kInfo[j]["基礎年金番号"]}; 従業員管理アプリの登録に失敗しました`
                );
              }
            }
          }
          break;
        }
      }
      if (!searchFlag) {
        logger.info(
          `会社名:${this.employee401kInfo[j]["企業事業所名"]}; 加入者メイ(半角):${this.employee401kInfo[j]["加入者メイ"]}; 基礎年金番号:${this.employee401kInfo[j]["基礎年金番号"]}; 従業員管理アプリに見つかりませんでした。`
        );
        this.query_catcher = `基礎年金番号 = "${this.employee401kInfo[j][
          "基礎年金番号"
        ].slice(0, 4)}-${this.employee401kInfo[j]["基礎年金番号"].slice(
          4
        )}" and Status in ("転記済") and Status2 not in ("完了")`;
        this.paramsSearch_catcher = {
          app: this.appId_catcher,
          query: this.query_catcher,
          fields: ["$id", "Status", "Status2"],
        };
        const responseSearch_catcher = await axios.get(this.url, {
          headers: this.headers_catcher,
          params: this.paramsSearch_catcher,
        });
        const records_catcher = responseSearch_catcher.data.records;
        for (let ii = 0; ii < records_catcher.length; ii++) {
          let tableaddobj_catcher = {
            app: this.appId_catcher,
            id: records_catcher[ii]["$id"].value,
            record: {
              Status2: {
                value: "登録エラー",
              },
            },
          };
          const responseData_post_catcher = await axios.put(
            this.url_1,
            tableaddobj_catcher,
            {
              headers: this.headers_catcher,
            }
          );
        }
      }
    }
    logger.info(`従業員管理アプリに登録:${this.appId}`);
  }

  //401kアプリに送信するデータを作成し、更新
  // async updateRecords401kApp() {
  //   for (let k = 0; k < this.appInfo.length; k++) {
  //     let record_content = {
  //       id: this.appInfo[k]["id"],
  //       record: {
  //         _401k加入有無: { value: this.appInfo[k]["_401k加入有無"] },
  //       },
  //     };
  //     this.records.push(record_content);
  //   }

  //   // レコードの更新リクエスト
  //   await putRecords(
  //     this.url,
  //     this.headers,
  //     this.appId,
  //     this.recordId,
  //     this.records
  //   );
  //   logger.info(`従業員管理アプリに登録:${this.appId}`);
  //   // console.log("レコードの更新が成功しました:", responseUpdate);
  // }
}

try {
  const Latchcsvreader = new LatchCsvReader();
  const latchData = Latchcsvreader.csvReader();

  const InformcsvReader = new InformCsvReader();
  const informData = InformcsvReader.csvReader();

  const employee401kInfo = latchData.map((latchRecord) => {
    const matchingInformRecord = informData.find(
      (informRecord) =>
        informRecord["加入者コード"] === latchRecord["加入者コード"]
    );

    if (!matchingInformRecord) {
      logger.debug(
        `加入者コードが一致しませんでした:${latchRecord["加入者コード"]}`
      );
      throw new TypeError();
    }

    return {
      ...latchRecord,
      生年月日: matchingInformRecord["生年月日"],
      性別: matchingInformRecord["性別"],
      加入者名: matchingInformRecord["加入者名"],
      加入者メイ: matchingInformRecord["加入者メイ"],
      入社年月日: matchingInformRecord["入社年月日"],
      郵便番号: matchingInformRecord["郵便番号"],
      住所1: matchingInformRecord["住所1"],
      住所2: matchingInformRecord["住所2"],
      住所3: matchingInformRecord["住所3"],
      基礎年金番号: matchingInformRecord["基礎年金番号"],
      加入資格取得年月日: matchingInformRecord["加入資格取得年月日"],
      拠出開始年月: matchingInformRecord["拠出開始年月"],
    };
  });

  // //従業員管理アプリに入力
  //非顧問先用
  const KintoneEmployeeAppNonAdvise = new KintoneEmployeeAppClient_NonAdvise(
    "3769",
    "rIdcJs8WaNahUJDXCwpp49kgkfZoKzVt3UYZwxgW",
    employee401kInfo
  );
  //非顧問先用
  const KintoneEmployeeApp999 = new KintoneEmployeeAppClient_NonAdvise(
    "3744",
    "gZ3X52cXyTCDDJdaITD6ZM0tkEQWo0TBJ4DexFh2",
    employee401kInfo,
    "3777",
    "MIeoCEGgxPPG6o55CpbVLoSb9aM0Q22aUHIl35YJ"
  );

  //401k全体管理アプリ
  const kintoneClient = new KintoneClient(
    "3759",
    "baxe8EUUKP5qsp717E8VQYE89xZNvbbLLaqrIuRc",
    employee401kInfo
  );

  //連絡キャッチャー&401k全体管理アプリ
  const ContactRecord = new ContactRecordTranscriber(
    "3759",
    "baxe8EUUKP5qsp717E8VQYE89xZNvbbLLaqrIuRc",
    "3777",
    "MIeoCEGgxPPG6o55CpbVLoSb9aM0Q22aUHIl35YJ"
  );

  kintoneClient
    .getRecords401kApp()
    .then(() => {
      kintoneClient.csvToObject();
      return kintoneClient.updateRecords401kApp();
    })
    // .then(() => {
    //   return new Promise((resolve) => setTimeout(resolve, 3000));
    // })
    .then(() => {
      return ContactRecord.getRecords401kCatcher();
    })
    // .then(() => {
    //   return KintoneEmployeeAppNonAdvise.getRecords401kApp();
    // })
    // .then(() => {
    //   KintoneEmployeeAppNonAdvise.csvToObject();
    //   return KintoneEmployeeAppNonAdvise.updateRecords401kApp();
    // })
    .then(() => {
      return KintoneEmployeeApp999.getRecords401kApp();
    })
    .then(() => {
      KintoneEmployeeApp999.csvToObject();
      // return KintoneEmployeeApp999.updateRecords401kApp();
    });
  // .then(() => {
  //   return KintoneEmployeeAppKobayashi.getRecords401kApp();
  // })
  // .then(() => {
  //   KintoneEmployeeAppKobayashi.csvToObject();
  //   return KintoneEmployeeAppKobayashi.updateRecords401kApp();
  // });
  // .then(() => {
  //   return KintoneEmployeeAppYSK.getRecords401kApp();
  // })
  // .then(() => {
  //   KintoneEmployeeAppYSK.csvToObject();
  //   return KintoneEmployeeAppYSK.updateRecords401kApp();
  // });
} catch (error) {
  logger.info("エラーが発生しました")
  if (error instanceof TypeError) {
    console.error(
      "An error has occurred. Please try again. "
    );
    logger.debug(error);
  } else {
    console.error("An error has occurred. Please try again");
    logger.debug(error.message);
  }
}

//post,putの関数
async function postRecords(url, headers, appId, appRegister) {
  const chunkSize = 100; // 一度に送信できる最大件数
  const totalRecords = appRegister.length;

  for (let i = 0; i < totalRecords; i += chunkSize) {
    const chunk = appRegister.slice(i, i + chunkSize); // データを100件ずつ分割

    const dataUpdate = {
      app: appId,
      records: chunk,
    };

    const responceRegister = await axios.post(url, dataUpdate, {
      headers: headers,
    });
    // return responceRegister;
    // console.log("レコードの追加が成功しました:", responceRegister.data);
  }
}

async function putRecords(url, headers, appId, recordId, appUpdate) {
  const chunkSize = 100; // 一度に送信できる最大件数
  const totalRecords = appUpdate.length;
  // console.log(totalRecords);

  for (let i = 0; i < totalRecords; i += chunkSize) {
    const chunk = appUpdate.slice(i, i + chunkSize); // データを100件ずつ分割

    const dataUpdate = {
      app: appId,
      id: recordId,
      records: chunk,
    };

    const responceUpdate = await axios.put(url, dataUpdate, {
      headers: headers,
    });
    // console.log("レコードの更新が成功しました:", responceUpdate.data);
  }
}

function formatDate(dateStr) {
  if (dateStr.length == 8) {
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);

    // フォーマットされた日付を返す
    return `${year}-${month}-${day}`;
  }
}

function kanaFullToHalf(str) {
  let kanaMap = {
    ガ: "ｶﾞ",
    ギ: "ｷﾞ",
    グ: "ｸﾞ",
    ゲ: "ｹﾞ",
    ゴ: "ｺﾞ",
    ザ: "ｻﾞ",
    ジ: "ｼﾞ",
    ズ: "ｽﾞ",
    ゼ: "ｾﾞ",
    ゾ: "ｿﾞ",
    ダ: "ﾀﾞ",
    ヂ: "ﾁﾞ",
    ヅ: "ﾂﾞ",
    デ: "ﾃﾞ",
    ド: "ﾄﾞ",
    バ: "ﾊﾞ",
    ビ: "ﾋﾞ",
    ブ: "ﾌﾞ",
    ベ: "ﾍﾞ",
    ボ: "ﾎﾞ",
    パ: "ﾊﾟ",
    ピ: "ﾋﾟ",
    プ: "ﾌﾟ",
    ペ: "ﾍﾟ",
    ポ: "ﾎﾟ",
    ヴ: "ｳﾞ",
    ヷ: "ﾜﾞ",
    ヺ: "ｦﾞ",
    ア: "ｱ",
    イ: "ｲ",
    ウ: "ｳ",
    エ: "ｴ",
    オ: "ｵ",
    カ: "ｶ",
    キ: "ｷ",
    ク: "ｸ",
    ケ: "ｹ",
    コ: "ｺ",
    サ: "ｻ",
    シ: "ｼ",
    ス: "ｽ",
    セ: "ｾ",
    ソ: "ｿ",
    タ: "ﾀ",
    チ: "ﾁ",
    ツ: "ﾂ",
    テ: "ﾃ",
    ト: "ﾄ",
    ナ: "ﾅ",
    ニ: "ﾆ",
    ヌ: "ﾇ",
    ネ: "ﾈ",
    ノ: "ﾉ",
    ハ: "ﾊ",
    ヒ: "ﾋ",
    フ: "ﾌ",
    ヘ: "ﾍ",
    ホ: "ﾎ",
    マ: "ﾏ",
    ミ: "ﾐ",
    ム: "ﾑ",
    メ: "ﾒ",
    モ: "ﾓ",
    ヤ: "ﾔ",
    ユ: "ﾕ",
    ヨ: "ﾖ",
    ラ: "ﾗ",
    リ: "ﾘ",
    ル: "ﾙ",
    レ: "ﾚ",
    ロ: "ﾛ",
    ワ: "ﾜ",
    ヲ: "ｦ",
    ン: "ﾝ",
    ァ: "ｧ",
    ィ: "ｨ",
    ゥ: "ｩ",
    ェ: "ｪ",
    ォ: "ｫ",
    ッ: "ｯ",
    ャ: "ｬ",
    ュ: "ｭ",
    ョ: "ｮ",
    "。": "｡",
    "、": "､",
    ー: "ｰ",
    "「": "｢",
    "」": "｣",
    "・": "･",
    "　": " ",
  };
  let reg = new RegExp("(" + Object.keys(kanaMap).join("|") + ")", "g");
  return str
    .replace(reg, function (s) {
      return kanaMap[s];
    })
    .replace(/゛/g, "ﾞ")
    .replace(/゜/g, "ﾟ");
}

// //従業員管理アプリに401k加入有無を転記
// class KintoneEmployeeAppClient {
//   constructor(guestSpaceId, appId, apiToken, employee401kInfo) {
//     this.subdomain = "nkr-group";
//     this.apiToken = apiToken;
//     this.appId = appId;
//     this.query = "limit 500";
//     this.guestSpaceId = guestSpaceId;
//     this.employee401kInfo = employee401kInfo;
//     this.appInfo = [];
//     this.records = [];

//     this.url = `https://${this.subdomain}.cybozu.com/k/guest/${this.guestSpaceId}/v1/records.json`;
//     this.headers = {
//       "X-Cybozu-API-Token": this.apiToken,
//     };
//     this.paramsSearch = {
//       app: this.appId,
//       query: this.query,
//     };
//     this.recordId = null;
//   }

//   //従業員管理アプリから全レコードの情報取得
//   async getRecords401kApp() {
//     const responseSearch = await axios.get(this.url, {
//       headers: this.headers,
//       params: this.paramsSearch,
//     });

//     const records = responseSearch.data.records;
//     if (records.length > 0) {
//       for (let i = 0; i < records.length; i++) {
//         let appInfo_1 = {
//           id: records[i].$id.value,
//           基礎年金番号: records[i].基礎年金番号.value,
//         };
//         this.appInfo.push(appInfo_1);
//       }
//       return this.appInfo;
//     } else {
//       console.log("条件に合うレコードが見つかりませんでした。");
//     }
//   }

//   //csvデータからデータ作成
//   async csvToObject() {
//     for (let i = 0; i < this.appInfo.length; i++) {
//       let searchFlag = false;
//       for (let j = 0; j < this.employee401kInfo.length; j++) {
//         if (
//           this.appInfo[i]["基礎年金番号"].replace(/-/g, "") ==
//             this.employee401kInfo[j]["基礎年金番号"] &&
//           this.employee401kInfo[j]["資格喪失日"] == "99999999"
//         ) {
//           this.appInfo[i]["_401k加入有無"] = "有";
//           searchFlag = true;
//         }
//       }
//       if (!searchFlag) {
//         this.appInfo[i]["_401k加入有無"] = "無";
//       }
//     }
//   }

//   //401kアプリに送信するデータを作成し、更新
//   async updateRecords401kApp() {
//     for (let k = 0; k < this.appInfo.length; k++) {
//       let record_content = {
//         id: this.appInfo[k]["id"],
//         record: {
//           _401k加入有無: { value: this.appInfo[k]["_401k加入有無"] },
//         },
//       };
//       this.records.push(record_content);
//     }

//     putRecords(this.url, this.headers, this.appId, this.recordId, this.records);
//     // console.log("レコードの更新が成功しました:", responseUpdate.data);
//   }
// }

// //小林商事株式会社
// const KintoneEmployeeAppKobayashi = new KintoneEmployeeAppClient_NonAdvise(
//   "3202",
//   "hBnf5TPbs3lfd8NRz3yjsTsnAfUBsuhBm1kJxlDx",
//   employee401kInfo
// );
// //YSKホールディングス
// const KintoneEmployeeAppYSK = new KintoneEmployeeAppClient(
//   "397",
//   "3717",
//   "LmxHKeL5aHfMXNMdAzD0bWSIxU7CIwald4tAxJGi",
//   employee401kInfo
// );
