import struct,zipfile,json,sys

def manifest(data):
    strings=[]; result=[]; offset=8
    while offset<len(data):
        kind,header,size=struct.unpack_from('<HHI',data,offset)
        if size<8:break
        if kind==1:
            count,stylecount,flags,start,stylestart=struct.unpack_from('<IIIII',data,offset+8)
            offsets=struct.unpack_from('<'+'I'*count,data,offset+header)
            def length(pos,utf8):
                if utf8:
                    v=data[pos];pos+=1
                    if v&128:v=((v&127)<<8)|data[pos];pos+=1
                else:
                    v=struct.unpack_from('<H',data,pos)[0];pos+=2
                    if v&32768:v=((v&32767)<<16)|struct.unpack_from('<H',data,pos)[0];pos+=2
                return v,pos
            for rel in offsets:
                pos=offset+start+rel
                if flags&256:
                    _,pos=length(pos,True);n,pos=length(pos,True);strings.append(data[pos:pos+n].decode('utf-8'))
                else:
                    n,pos=length(pos,False);strings.append(data[pos:pos+n*2].decode('utf-16le'))
        if kind==0x102:
            ns,name,attrstart,attrsize,count=struct.unpack_from('<IIHHH',data,offset+16)
            attrs={}
            for n in range(count):
                pos=offset+16+attrstart+n*attrsize
                ans,aname,raw=struct.unpack_from('<III',data,pos)
                dtype=data[pos+15];value=struct.unpack_from('<I',data,pos+16)[0]
                attrs[strings[aname]]=strings[value] if dtype==3 else (bool(value) if dtype==18 else value)
            result.append({'tag':strings[name],'attrs':attrs})
        offset+=size
    return result

if __name__=='__main__':
 for filename in sys.argv[1:]:
    with zipfile.ZipFile(filename) as archive:
        tags=manifest(archive.read('AndroidManifest.xml'))
        print(json.dumps({'file':filename,'abis':sorted({n.split('/')[1] for n in archive.namelist() if n.startswith('lib/')}),'manifest':[t for t in tags if t['tag'] in ['manifest','uses-sdk','application','uses-feature']]}))
