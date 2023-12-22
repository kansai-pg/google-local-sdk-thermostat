#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Arduino.h>
#include <IRac.h>
#include <IRsend.h>

#define LOCAL_HOME_SERVER_PORT 3388

EthernetServer server(LOCAL_HOME_SERVER_PORT);
IRHitachiAc424 ac_controller(25);
IRsend irsend(25);

class LocalHomeServer {
public:
  void begin();
  void task();
  void reportState();
};

LocalHomeServer localHomeSrv;

void LocalHomeServer::begin() {
  ac_controller.begin();
  irsend.begin();
  Serial.printf("Http Server at port %d\n", LOCAL_HOME_SERVER_PORT);
}


void LocalHomeServer::task() {
  EthernetClient client = server.available();
  if (client) {
    String currentLine = "";
    while (client.connected()) {
      if (client.available()) {
        char c = client.read();
        if (c == '\n') {
          if (currentLine.length() == 0) {
            StaticJsonDocument<200> doc;
            JsonObject object = doc.as<JsonObject>();
            String json = client.readStringUntil('\r');
            deserializeJson(doc, json);
            Serial.println(json);

            // 温度設定
            if (doc.containsKey("thermostatTemperatureSetpoint")) {

              int thermostatTemperatureSetpoint = doc["thermostatTemperatureSetpoint"];
              
              ac_controller.on();
              ac_controller.setTemp(thermostatTemperatureSetpoint);
              Serial.println("thermostatTemperatureSetpoint: " + String(thermostatTemperatureSetpoint));


              reportState();
            }
            // エアコンの動作モード
            if (doc.containsKey("thermostatMode")) {
              ac_controller.on();
              if (doc["thermostatMode"] == "off") {
                // reportState()の呼び出しまで処理が走らないように returnで終了させる
                ac_controller.off();
                ac_controller.send();
                Serial.println("off");
                return;

              } else if (doc["thermostatMode"] == "cool") {
                ac_controller.setMode(kHitachiAc424Cool);
                Serial.println("thermostatMode: cool");

              } else if (doc["thermostatMode"] == "heat") {
                ac_controller.setMode(kHitachiAc424Heat);
                Serial.println("thermostatMode: heat");

              } else if (doc["thermostatMode"] == "dry") {
                ac_controller.setMode(kHitachiAc424Dry);
                Serial.println("thermostatMode: dry");

              } else if (doc["thermostatMode"] == "fan-only") {
                ac_controller.setMode(kHitachiAc424Fan);
                Serial.println("thermostatMode: fan-only");
              }

              reportState();
            }
            // 証明のOnOff
            if (doc.containsKey("lightOnOff")) {
              if (doc["lightOnOff"]) {
                irsend.sendNEC(0x41B6659A);
                Serial.println("on");
              } else {
                irsend.sendNEC(0x41B67D82);
                Serial.println("off");
              }
            }

            client.println("HTTP/1.1 200 OK");
            client.println("Content-type:text/html");
            client.println();
            break;
          } else {
            currentLine = "";
          }
        } else if (c != '\r') {
          currentLine += c;
        }
      }
    }
    client.stop();
  }
}

void LocalHomeServer::reportState() {
  ac_controller.setFan(5);
  // エアコン or 照明 へ赤外線を送る
  ac_controller.send();
}