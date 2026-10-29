from pathlib import Path
import sys
text=Path(sys.argv[1]).read_text()
for expected in ("package: name='com.yakuza.video'", "native-code: 'armeabi-v7a'", "sdkVersion:'24'", "application-label:'YakuzaVideo'"):
    assert expected in text, expected
print("Android tools confirm package, label, minimum SDK and armeabi-v7a")
