#include <FastLED.h>
#include "class_files.h"
#include <Ethernet.h>
#include <EthernetUdp.h>
#include <SPI.h>
#include "httpsrv.h"
#include "firebase.h"

#define DISCOVERY_PACKET "HelloLocalHomeSDK"
#define DEVICEID "deviceid123"

class LocalHomeUDP {
public:
  EthernetUDP Udp;
  unsigned int localUdpPort = 3311;

  char incomingPacket[255];

  void begin() {
    Udp.begin(localUdpPort);
    Serial.printf("Now listening at UDP port %d\n", localUdpPort);
  }

  void task() {
    int packetSize = Udp.parsePacket();
    if (!packetSize) return;

    int len = Udp.read(incomingPacket, 255);
    Serial.printf("UDP packet contents: %s\n", incomingPacket);
    if (len > 0) {
      incomingPacket[len] = 0;
    }

    int messLen = strlen(incomingPacket) + 1;
    char mess[messLen];
    strncpy(mess, incomingPacket, messLen - 1);
    mess[messLen - 1] = 0;
    Serial.println(mess);

    if (strcmp(mess, DISCOVERY_PACKET) != 0) {
      Serial.printf("The received message is not '%s'\n", DISCOVERY_PACKET);
      return;
    }
    Serial.println("The received message is ok");

    Udp.beginPacket(Udp.remoteIP(), Udp.remotePort());
    Udp.write(DEVICEID);
    Udp.endPacket();
  }
};

LocalHomeUDP udp;

void setup() {
  SPI.begin(22, 23, 33, -1);
  Ethernet.init(19);

  FastLED.addLeds<NEOPIXEL, 27>(leds, NUM_LEDS);

  // Set all LEDs to white color
  fill_solid(leds, NUM_LEDS, CRGB::White);
  FastLED.show();

  Serial.begin(115200);

  if (Ethernet.linkStatus() == LinkON) {
    Ethernet.begin(mac_address.mac);
    Serial.print("server is at ");
    Serial.println(Ethernet.localIP());
  } else {
    Serial.println("Ethernet cable not connected, or no link detected");
    blinkLED_class.blinkLED(CRGB::Red, 1000);  // Continuous red LED blinking
    ESP.restart();
  }

  udp.begin();
  localHomeSrv.begin();
  FirebaseData_Class.begin();
}

void loop() {
  udp.task();
  localHomeSrv.task();
  FirebaseData_Class.task();
}
