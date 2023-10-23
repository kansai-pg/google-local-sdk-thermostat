#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Arduino.h>
#include <IRac.h>

#define LOCAL_HOME_SERVER_PORT 3388

EthernetServer server(LOCAL_HOME_SERVER_PORT);
IRHitachiAc424 ac_controller(25);

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
};

LocalHomeServer localHomeSrv;
Status status;

void LocalHomeServer::begin() {
  ac_controller.begin();
  Serial.printf("Http Server at port %d\n", LOCAL_HOME_SERVER_PORT);
  status.thermostatTemperatureSetpoint = 0;
  status.thermostatMode = "";
}


void LocalHomeServer::task() {
  EthernetClient client = server.available();
  if (client) {
    String currentLine = "";
    while (client.connected()) {
      if (client.available()) {
        Serial.println("client");
        char c = client.read();
        if (c == '\n') {
          if (currentLine.length() == 0) {
            StaticJsonDocument<200> doc;
            JsonObject object = doc.as<JsonObject>();
            String json = client.readStringUntil('\r');
            deserializeJson(doc, json);
            Serial.println(json);

            if (doc.containsKey("thermostatTemperatureSetpoint")) {
              status.thermostatTemperatureSetpoint = doc["thermostatTemperatureSetpoint"];
            }
            if (doc.containsKey("thermostatMode")) {
              status.thermostatMode = doc["thermostatMode"].as<String>();
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
    Serial.printf("cool");
  } else if (thermostatMode == "heat") {
    ac_controller.setMode(kHitachiAc424Heat);
    Serial.printf("heat");
  } else if (thermostatMode == "dry") {
    ac_controller.setMode(kHitachiAc424Dry);
    Serial.printf("dry");
  } else if (thermostatMode == "fan") {
    ac_controller.setMode(kHitachiAc424Fan);
    Serial.printf("fan");
  }

  ac_controller.setFan(5);
  ac_controller.send();
}