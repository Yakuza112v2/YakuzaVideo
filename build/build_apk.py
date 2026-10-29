"""Build YakuzaVideo from pinned Android runtime components.
Modified 2026-10-29. Embedded third-party notices remain unchanged.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path
import struct
import zipfile
from inspect_apk import manifest

UPSTREAM_PACKAGE = "io.gh.reisxd.tizentube.cobalt"
PACKAGE = "com.yakuza.video"
APK_SHA256 = "72a3527f520db3a1b414916ad96481244e451c41e272ae33344ae5e79abb37dd"
SCRIPT_SHA256 = "7a092351e0e348507ef9c97da8833d5f6717de628517f5299053b3c2073f1d69"
OLD_URL = b"https://cdn.jsdelivr.net/npm/@foxreis/tizentube/dist/userScript.js?v="
NEW_URL = b"https://cdn.jsdelivr.net/gh/Yakuza112v2/YakuzaVideo@main/player.js?v="
OLD_API = "https://api.github.com/repos/reisxd/TizenTubeCobalt/releases/latest"
NEW_API = "https://api.github.com/repos/Yakuza112v2/YakuzaVideo/releases/latest"
ASSET = "YakuzaVideo-armeabi-v7a.apk"
BRANDING_DIRECTORY = Path(__file__).resolve().parent.parent / "assets" / "launcher"


def launcher_artwork():
    entries = json.loads((BRANDING_DIRECTORY / "manifest.json").read_text(encoding="utf-8"))
    result = {}
    for resource, entry in entries.items():
        data = (BRANDING_DIRECTORY / entry["file"]).read_bytes()
        assert hashlib.sha256(data).hexdigest() == entry["sha256"], resource
        assert data[:8] == b"\x89PNG\r\n\x1a\n", resource
        assert struct.unpack_from(">II", data, 16) == (entry["width"], entry["height"]), resource
        result[resource] = data
    return result


def verify(path, expected):
    if hashlib.sha256(Path(path).read_bytes()).hexdigest() != expected:
        raise ValueError("Upstream download hash mismatch: " + str(path))


def read_pool(data):
    header = struct.unpack_from("<H", data, 2)[0]
    count, styles, flags, start, style_start = struct.unpack_from("<IIIII", data, 8)
    offsets = struct.unpack_from("<" + "I" * count, data, header)
    def length(pos, utf8):
        if utf8:
            value = data[pos]; pos += 1
            if value & 128:
                value = ((value & 127) << 8) | data[pos]; pos += 1
        else:
            value = struct.unpack_from("<H", data, pos)[0]; pos += 2
            if value & 32768:
                value = ((value & 32767) << 16) | struct.unpack_from("<H", data, pos)[0]; pos += 2
        return value, pos
    strings = []
    for offset in offsets:
        pos = start + offset
        if flags & 256:
            _, pos = length(pos, True)
            size, pos = length(pos, True)
            strings.append(data[pos:pos+size].decode("utf-8"))
        else:
            size, pos = length(pos, False)
            strings.append(data[pos:pos+size*2].decode("utf-16le"))
    return strings, (header, count, styles, flags, style_start)


def write_pool(original, strings, metadata):
    header, count, styles, flags, style_start = metadata
    flags &= ~1  # Modified strings no longer satisfy the sorted-pool flag.
    def encoded_length(value, utf8):
        if utf8:
            if value > 32767: raise ValueError("UTF-8 string too long")
            return bytes([value]) if value < 128 else bytes([(value >> 8) | 128, value & 255])
        return struct.pack("<H", value) if value < 32768 else struct.pack("<HH", (value >> 16) | 32768, value & 65535)
    payload = bytearray(); offsets = []
    for value in strings:
        offsets.append(len(payload))
        utf16_size = len(value.encode("utf-16le")) // 2
        if flags & 256:
            encoded = value.encode("utf-8")
            payload += encoded_length(utf16_size, True) + encoded_length(len(encoded), True) + encoded + b"\0"
        else:
            payload += encoded_length(utf16_size, False) + value.encode("utf-16le") + b"\0\0"
    payload += b"\0" * (-len(payload) % 4)
    style_offsets = original[header+count*4:header+(count+styles)*4]
    style_data = original[style_start:] if style_start else b""
    start = header + (count + styles) * 4
    new_style_start = start + len(payload) if style_start else 0
    output = bytearray(original[:header])
    output += struct.pack("<" + "I" * count, *offsets) + style_offsets + payload + style_data
    struct.pack_into("<I", output, 4, len(output))
    struct.pack_into("<IIIII", output, 8, count, styles, flags, start, new_style_start)
    return output


def adapt_manifest(data, version, version_code):
    chunks = []; offset = 8; strings = None; pool_index = None; pool_meta = None
    while offset < len(data):
        kind, header, size = struct.unpack_from("<HHI", data, offset)
        chunk = bytearray(data[offset:offset+size])
        if kind == 1:
            strings, pool_meta = read_pool(chunk); pool_index = len(chunks)
        elif kind == 0x102:
            _, tag, attr_start, attr_size, count = struct.unpack_from("<IIHHH", chunk, 16)
            for index in range(count):
                pos = 16 + attr_start + index * attr_size
                _, name, raw = struct.unpack_from("<III", chunk, pos)
                name = strings[name]; value_type = chunk[pos+15]
                value = struct.unpack_from("<I", chunk, pos+16)[0]
                if strings[tag] == "manifest" and name == "versionCode":
                    assert value_type == 16
                    struct.pack_into("<I", chunk, pos+16, version_code)
                if strings[tag] == "manifest" and name == "versionName":
                    assert value_type == 3
                    strings[value] = version
                if strings[tag] == "application" and name == "debuggable":
                    struct.pack_into("<I", chunk, pos+16, 0)
        chunks.append(chunk); offset += size
    for i, value in enumerate(strings):
        if value == UPSTREAM_PACKAGE or value.startswith(UPSTREAM_PACKAGE + "."):
            strings[i] = PACKAGE + value[len(UPSTREAM_PACKAGE):]
        elif value == "TizenTube":
            strings[i] = "YakuzaVideo"
    chunks[pool_index] = write_pool(chunks[pool_index], strings, pool_meta)
    output = bytearray(data[:8]) + b"".join(chunks)
    struct.pack_into("<I", output, 4, len(output))
    tags = manifest(output)
    root = next(t["attrs"] for t in tags if t["tag"] == "manifest")
    assert root["package"] == PACKAGE and root["versionCode"] == version_code and root["versionName"] == version
    return output


def adapt_resources(data):
    data = bytearray(data); offset = struct.unpack_from("<H", data, 2)[0]; changed = 0
    while offset < len(data):
        kind, header, size = struct.unpack_from("<HHI", data, offset)
        if kind == 0x200:
            name = data[offset+12:offset+268].decode("utf-16le").split("\0")[0]
            if name == UPSTREAM_PACKAGE:
                encoded = PACKAGE.encode("utf-16le")
                data[offset+12:offset+268] = encoded + b"\0" * (256 - len(encoded)); changed += 1
        offset += size
    assert changed == 1, "Unexpected Android resource package"
    return data


def adapt_script(source):
    for old, new in [(OLD_API, NEW_API), ('includes("arm64.apk")', 'includes("armeabi-v7a.apk")'), ('includes("arm.apk")', 'includes("armeabi-v7a.apk")')]:
        assert source.count(old) == 1, "Unexpected userscript update implementation"
        source = source.replace(old, new)
    support = source.index('{name:ga("settings.supportTT.title")')
    social = source.index('{name:ga("settings.options.socialMedia.title")', support)
    source = source[:support] + source[social:]
    social_start = source.index('[{name:"GitHub",link:')
    social_end = source.index('].map(e=>', social_start) + 1
    source = source[:social_start] + '[{name:"GitHub",link:"https://github.com/Yakuza112v2/YakuzaVideo"}]' + source[social_end:]
    source = source.replace('subtitle:ga("settings.ttSettings.madeByText")', 'subtitle:"YakuzaVideo"')
    # Rename interface labels and their matching internal keys, keeping source URLs intact.
    parts = re.split(r'(https?://[^\s"\'`<>]+)', source)
    for index in range(0, len(parts), 2):
        parts[index] = parts[index].replace("TizenTube Cobalt", "YakuzaVideo").replace("TizenTubeCobalt", "YakuzaVideo").replace("TizenTube", "YakuzaVideo")
    source = "".join(parts)
    source = re.sub(r'madeByText:"(?:[^"\\]|\\.)*"', 'madeByText:"YakuzaVideo"', source)
    return "/* YakuzaVideo, 2026-10-29. https://github.com/Yakuza112v2/YakuzaVideo */\n" + source


def build(apk, script, output, run):
    verify(apk, APK_SHA256); verify(script, SCRIPT_SHA256)
    version = "1.0." + str(run); code = int(run)
    output = Path(output); output.mkdir(parents=True, exist_ok=True)
    artwork = launcher_artwork()
    with zipfile.ZipFile(apk) as source, zipfile.ZipFile(output/"unsigned.apk", "w") as target:
        assert set(artwork).issubset(source.namelist()), "Missing launcher resource"
        for info in source.infolist():
            upper = info.filename.upper()
            if upper == "META-INF/MANIFEST.MF" or (upper.startswith("META-INF/") and upper.endswith((".SF", ".RSA", ".DSA", ".EC"))): continue
            data = source.read(info)
            if info.filename == "AndroidManifest.xml": data = adapt_manifest(data, version, code)
            elif info.filename == "resources.arsc": data = adapt_resources(data)
            elif info.filename in artwork: data = artwork[info.filename]
            elif info.filename == "lib/armeabi-v7a/libchrobalt.so":
                assert len(OLD_URL) == len(NEW_URL) and data.count(OLD_URL) == 1
                data = data.replace(OLD_URL, NEW_URL)
            target.writestr(info, data)
    (output/"player.js").write_text(adapt_script(Path(script).read_text(encoding="utf-8")), encoding="utf-8", newline="\n")
    base = "https://github.com/Yakuza112v2/YakuzaVideo/releases/download/v" + version
    updates = {"package":{"downloadUrl":base+"/"+ASSET}, version:{"versionCode":code,
        "changelog":["YakuzaVideo for armeabi-v7a."],
        "changelog_de":["YakuzaVideo mit eigenem App-Icon und TV-Kachel.","Eigene Oberfläche, Werbeblockierung und GitHub-Updates.","Android 7 oder neuer erforderlich."]}}
    (output/"update.json").write_text(json.dumps(updates, indent=2, ensure_ascii=False)+"\n", encoding="utf-8")
    (output/"build.json").write_text(json.dumps({"version":version,"versionCode":code,"package":PACKAGE,"abi":"armeabi-v7a","minSdk":24,"upstreamApkSha256":APK_SHA256},indent=2)+"\n",encoding="utf-8")
    print("Prepared", version, "ABI armeabi-v7a, package", PACKAGE)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("apk"); parser.add_argument("script"); parser.add_argument("output"); parser.add_argument("run",type=int)
    args=parser.parse_args();build(args.apk,args.script,args.output,args.run)
