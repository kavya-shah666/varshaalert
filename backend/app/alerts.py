"""
alerts.py - Builds alert messages (English + Hindi + regional language)
and sends them as SMS using Twilio.

If Twilio keys are NOT set in backend/.env, we run in DEMO MODE:
nothing is sent, and the dashboard shows a phone-style notification instead.
"""
import os

from app.config import BASE_DIR, LEVEL_INFO

# ---------- read backend/.env (simple KEY=VALUE file) ----------
env_file = BASE_DIR / ".env"
if env_file.exists():
    for line in env_file.read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.strip().startswith("#"):
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())

TWILIO_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_FROM = os.getenv("TWILIO_FROM_NUMBER", "")
ALERT_NUMBERS = [n.strip() for n in os.getenv("ALERT_PHONE_NUMBERS", "").split(",") if n.strip()]
DEMO_MODE = not (TWILIO_SID and TWILIO_TOKEN and TWILIO_FROM and ALERT_NUMBERS)

# ---------- message templates ----------
HINDI_LEVEL = {"green": "हरा - सामान्य", "yellow": "पीली निगरानी", "orange": "नारंगी अलर्ट", "red": "लाल चेतावनी"}
HINDI_DESC = {"green": "भारी वर्षा की संभावना नहीं है", "yellow": "भारी वर्षा की संभावना है",
              "orange": "बहुत भारी वर्षा की संभावना है", "red": "अत्यंत भारी वर्षा की संभावना है"}

# Regional language per state: (language name, warning sentence)
REGIONAL = {
    "Kerala": ("Malayalam", "അടുത്ത 24 മണിക്കൂറിൽ കനത്ത മഴ മുന്നറിയിപ്പ്. താഴ്ന്ന പ്രദേശങ്ങൾ ഒഴിവാക്കുക, സുരക്ഷിതരായിരിക്കുക."),
    "Tamil Nadu": ("Tamil", "அடுத்த 24 மணி நேரத்தில் கனமழை எச்சரிக்கை. தாழ்வான பகுதிகளைத் தவிர்க்கவும், பாதுகாப்பாக இருக்கவும்."),
    "Maharashtra": ("Marathi", "पुढील 24 तासांत मुसळधार पावसाचा इशारा. सखल भागांपासून दूर राहा, सुरक्षित राहा."),
    "Assam": ("Assamese", "অহা ২৪ ঘণ্টাত প্ৰবল বৰষুণৰ সতৰ্কবাণী। নিম্নাঞ্চল এৰি চলক, সুৰক্ষিত থাকক।"),
}


def build_messages(district: dict, level: str) -> dict:
    """Create the alert text for one district in 3 languages."""
    info = LEVEL_INFO[level]
    name = district["name"]
    en = (f"VarshaAlert [{info['en']}] {name}: {info['desc']} in the next 24 hrs. "
          f"Avoid low-lying areas and river banks, stay indoors, follow district administration. "
          f"Helpline 1077. -MoES/IMD")
    hi = (f"वर्षा अलर्ट [{HINDI_LEVEL[level]}] {name}: अगले 24 घंटों में {HINDI_DESC[level]}। "
          f"निचले इलाकों और नदी किनारों से दूर रहें, सुरक्षित स्थान पर रहें। हेल्पलाइन 1077")
    lang, sentence = REGIONAL.get(district["state"], ("", ""))
    regional = f"[{info['en']}] {name}: {sentence}" if sentence else ""
    return {"message_en": en, "message_hi": hi, "message_regional": regional, "regional_language": lang}


def send_sms(text: str) -> str:
    """Send one SMS to every registered number. Returns a status string."""
    if DEMO_MODE:
        return "demo"
    try:
        from twilio.rest import Client       # imported here so demo mode works without network
        client = Client(TWILIO_SID, TWILIO_TOKEN)
        for number in ALERT_NUMBERS:
            client.messages.create(body=text, from_=TWILIO_FROM, to=number)
        return f"sent to {len(ALERT_NUMBERS)}"
    except Exception as e:                   # no internet, wrong keys, unverified number...
        return f"failed: {str(e)[:120]}"
