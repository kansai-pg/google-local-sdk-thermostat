#define NUM_LEDS 100
CRGB leds[NUM_LEDS];

class BlinkLEDclass {
  public:
    void blinkLED(CRGB color, int duration);
};

class mac {
  public:
    byte mac[6] = { 0xDE, 0xAD, 0xBE, 0xEF, 0xFE, 0xED };
};

BlinkLEDclass blinkLED_class;
mac mac_address;

void BlinkLEDclass::blinkLED(CRGB color, int duration) {
  int numBlinks = 5;  // Number of blinks
  for (int i = 0; i < numBlinks; i++) {
    fill_solid(leds, NUM_LEDS, color);
    FastLED.show();
    delay(duration);
    fill_solid(leds, NUM_LEDS, CRGB::Black);
    FastLED.show();
    delay(duration);
  }
}