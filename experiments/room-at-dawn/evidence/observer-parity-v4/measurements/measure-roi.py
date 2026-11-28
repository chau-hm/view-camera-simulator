import sys,struct,zlib,json

def read(path):
 d=open(path,'rb').read(); off=8; compressed=b''; w=h=0
 while off<len(d):
  n=int.from_bytes(d[off:off+4],'big'); typ=d[off+4:off+8]; chunk=d[off+8:off+8+n]; off+=12+n
  if typ==b'IHDR':
   w,h,depth,color,_,_,interlace=struct.unpack('>IIBBBBB',chunk)
   assert depth==8 and color==2 and interlace==0
  if typ==b'IDAT': compressed+=chunk
  if typ==b'IEND':break
 raw=zlib.decompress(compressed); stride=w*3; prev=[0]*stride; rows=[]; i=0
 for _ in range(h):
  kind=raw[i];i+=1; src=raw[i:i+stride];i+=stride; row=[]
  for x,v in enumerate(src):
   a=row[x-3] if x>=3 else 0;b=prev[x];c=prev[x-3] if x>=3 else 0
   if kind==0:q=0
   elif kind==1:q=a
   elif kind==2:q=b
   elif kind==3:q=(a+b)//2
   elif kind==4:
    p=a+b-c;pa=abs(p-a);pb=abs(p-b);pc=abs(p-c);q=a if pa<=pb and pa<=pc else b if pb<=pc else c
   else:raise ValueError(kind)
   row.append((v+q)&255)
  rows.append(row);prev=row
 return w,h,rows
w,h,a=read(sys.argv[1]);w2,h2,b=read(sys.argv[2]);assert (w,h)==(w2,h2)
x,y,ww,hh=map(int,sys.argv[3:7]); assert 0<=x<x+ww<=w and 0<=y<y+hh<=h
s=0; changed=0; m1=0; m2=0
for yy in range(y,y+hh):
 for xx in range(x,x+ww):
  av=a[yy][3*xx:3*xx+3]; bv=b[yy][3*xx:3*xx+3]; delta=sum(abs(i-j) for i,j in zip(av,bv));s+=delta;changed+=delta>6
  m1+=sum(i*j for i,j in zip(av,(.2126,.7152,.0722)));m2+=sum(i*j for i,j in zip(bv,(.2126,.7152,.0722)))
n=ww*hh
print(json.dumps({'roi':{'x':x,'y':y,'width':ww,'height':hh},'meanAbsoluteRgb8':s/(3*n),'changedPixelFraction':changed/n,'meanLuma8On':m1/n,'meanLuma8Off':m2/n,'measurement':'display-referred screenshots, not linear radiance'},indent=2))
