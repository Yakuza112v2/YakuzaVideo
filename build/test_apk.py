import json,struct,unittest,zipfile,os
from pathlib import Path
from inspect_apk import manifest
from build_apk import PACKAGE,UPSTREAM_PACKAGE,OLD_URL,NEW_URL,NEW_API,ASSET,launcher_artwork
class YakuzaVideoApkTest(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.source=zipfile.ZipFile(os.environ["COBALT_ORIGINAL"])
  cls.output=zipfile.ZipFile(os.environ["COBALT_OUTPUT"])
  cls.directory=Path(os.environ["COBALT_DIRECTORY"])
  cls.tags=manifest(cls.output.read("AndroidManifest.xml"))
 def test_package_version_name_and_minimum_sdk(self):
  root=next(t["attrs"] for t in self.tags if t["tag"]=="manifest")
  sdk=next(t["attrs"] for t in self.tags if t["tag"]=="uses-sdk")
  app=next(t["attrs"] for t in self.tags if t["tag"]=="application")
  build=json.loads((self.directory/"build.json").read_text(encoding="utf-8"))
  self.assertEqual(PACKAGE,root["package"]);self.assertEqual(build["versionCode"],root["versionCode"])
  self.assertGreater(root["versionCode"],0);self.assertEqual(build["version"],root["versionName"])
  self.assertEqual(24,sdk["minSdkVersion"]);self.assertEqual("YakuzaVideo",app["label"])
  self.assertFalse(app["debuggable"])
 def test_abi_is_armeabi_v7a(self):
  abis={n.split("/")[1] for n in self.output.namelist() if n.startswith("lib/")}
  self.assertEqual({"armeabi-v7a"},abis)
  data=self.output.read("lib/armeabi-v7a/libchrobalt.so")
  self.assertEqual(b"\x7fELF",data[:4]);self.assertEqual(1,data[4]);self.assertEqual(40,struct.unpack_from("<H",data,18)[0])
 def test_android_bytecode_is_preserved(self):
  dex=[n for n in self.source.namelist() if n.endswith(".dex")];self.assertTrue(dex)
  for name in dex:self.assertEqual(self.source.read(name),self.output.read(name))
 def test_native_change_is_only_script_endpoint(self):
  old=self.source.read("lib/armeabi-v7a/libchrobalt.so");new=self.output.read("lib/armeabi-v7a/libchrobalt.so")
  self.assertEqual(old.replace(OLD_URL,NEW_URL),new);self.assertNotIn(OLD_URL,new);self.assertEqual(len(old),len(new))
  n="lib/armeabi-v7a/libchrome_crashpad_handler.so";self.assertEqual(self.source.read(n),self.output.read(n))
 def test_resource_namespace_tracks_application_id(self):
  data=self.output.read("resources.arsc");o=struct.unpack_from("<H",data,2)[0];names=[]
  while o<len(data):
   kind,header,size=struct.unpack_from("<HHI",data,o)
   if kind==0x200:names.append(data[o+12:o+268].decode("utf-16le").split("\0")[0])
   o+=size
  self.assertIn(PACKAGE,names);self.assertNotIn(UPSTREAM_PACKAGE,names)
 def test_release_manifest(self):
  update=json.loads((self.directory/"update.json").read_text(encoding="utf-8"))
  version=json.loads((self.directory/"build.json").read_text(encoding="utf-8"))["version"]
  self.assertGreater(update[version]["versionCode"],0)
  self.assertTrue(update["package"]["downloadUrl"].endswith("/"+ASSET))
  self.assertIn("/releases/download/v"+version+"/",update["package"]["downloadUrl"])
 def test_other_payloads_and_notices_are_preserved(self):
  modified={"AndroidManifest.xml","resources.arsc","lib/armeabi-v7a/libchrobalt.so"}
  modified.update(launcher_artwork())
  for name in self.source.namelist():
   upper=name.upper()
   signature=upper=="META-INF/MANIFEST.MF" or (upper.startswith("META-INF/") and upper.endswith((".SF",".RSA",".DSA",".EC")))
   if name not in modified and not signature:self.assertEqual(self.source.read(name),self.output.read(name),name)
 def test_launcher_resources_are_replaced_in_every_density(self):
  artwork=launcher_artwork()
  original={n for n in self.source.namelist() if (n.startswith("res/mipmap-") and n.endswith("/ic_app")) or (n.startswith("res/drawable") and n.endswith("/app_banner"))}
  self.assertEqual(original,set(artwork));self.assertEqual(10,len(artwork))
  for name,data in artwork.items():
   self.assertEqual(data,self.output.read(name));self.assertNotEqual(self.source.read(name),data)
 def test_launcher_manifest_keeps_icon_banner_and_tv_entry(self):
  original=manifest(self.source.read("AndroidManifest.xml"))
  old=next(t["attrs"] for t in original if t["tag"]=="application")
  app=next(t["attrs"] for t in self.tags if t["tag"]=="application")
  self.assertEqual(old["icon"],app["icon"]);self.assertEqual(old["banner"],app["banner"])
  categories={t["attrs"].get("name") for t in self.tags if t["tag"]=="category"}
  self.assertIn("android.intent.category.LAUNCHER",categories)
  self.assertIn("android.intent.category.LEANBACK_LAUNCHER",categories)
 def test_userscript_uses_own_update_source(self):
  script=(self.directory/"player.js").read_text(encoding="utf-8")
  self.assertIn(NEW_API,script);self.assertNotIn("api.github.com/repos/reisxd/TizenTubeCobalt/releases/latest",script)
  self.assertEqual(2,script.count('includes("armeabi-v7a.apk")'))
 def test_interface_and_community_links_use_yakuzavideo(self):
  script=(self.directory/"player.js").read_text(encoding="utf-8").split("\n",1)[1]
  self.assertNotIn("TizenTube Settings",script);self.assertNotIn("TizenTube Cobalt Updater",script)
  self.assertNotIn('{name:ga("settings.supportTT.title")',script)
  self.assertIn('subtitle:"YakuzaVideo"',script)
  start=script.index('[{name:"GitHub",link:');end=script.index('].map(e=>',start)+1
  self.assertEqual('[{name:"GitHub",link:"https://github.com/Yakuza112v2/YakuzaVideo"}]',script[start:end])
if __name__=="__main__":unittest.main()
