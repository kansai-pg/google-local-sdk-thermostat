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

class Status {
public:
  int thermostatTemperatureSetpoint;
  String thermostatMode;
  bool lightOnOff;
};

LocalHomeServer localHomeSrv;
Status status;

void LocalHomeServer::begin() {
  ac_controller.begin();
  irsend.begin();
  Serial.printf("Http Server at port %d\n", LOCAL_HOME_SERVER_PORT);
  status.thermostatTemperatureSetpoint = 16;
  status.thermostatMode = "fan";
  status.lightOnOff = false;
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
              status.thermostatTemperatureSetpoint = doc["thermostatTemperatureSetpoint"];
            }
            // エアコンの動作モード
            if (doc.containsKey("thermostatMode")) {
              status.thermostatMode = doc["thermostatMode"].as<String>();
            }
            // 証明のOnOff
            if(doc.containsKey("lightOnOff")) {
              status.lightOnOff = doc["lightOnOff"];
            }
            Serial.printf("thermostatTemperatureSetpoint:%d, thermostatMode:%s\n", status.thermostatTemperatureSetpoint, status.thermostatMode.c_str());

            reportState();

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

  ac_controller.on();
  ac_controller.setTemp(status.thermostatTemperatureSetpoint);
  String thermostatMode = status.thermostatMode;

  if (thermostatMode == "off"){
    ac_controller.off();

  } else if (thermostatMode == "cool") {
    ac_controller.setMode(kHitachiAc424Cool);

  } else if (thermostatMode == "heat") {
    ac_controller.setMode(kHitachiAc424Heat);

  } else if (thermostatMode == "dry") {
    ac_controller.setMode(kHitachiAc424Dry);

  } else if (thermostatMode == "fan") {
    ac_controller.setMode(kHitachiAc424Fan);

  }

  ac_controller.setFan(5);
  ac_controller.send();

  if (status.lightOnOff){
    irsend.sendNEC(0x41B6659A);
    Serial.println("on");
    return;
  } else {
    irsend.sendNEC(0x41B67D82);
    Serial.println("off");
    return;
  }
}