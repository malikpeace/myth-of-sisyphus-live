(function(root){
  "use strict";
  var skies={
    hills:[[49,119,163],[70,145,182],[119,177,196],[167,203,211]],
    waterfalls:[[45,42,65],[81,66,88],[141,98,120],[202,149,147]],
    "moon-rome":[[5,12,33],[11,23,53],[20,38,71],[48,65,90]],
    snow:[[73,91,112],[112,132,150],[159,180,194],[208,220,228]],
    "sunset-rome":[[68,47,74],[157,81,88],[221,133,102],[249,191,124]],
    blossom:[[34,25,49],[82,45,78],[172,83,118],[244,155,152]]
  };
  function Scenes(architecture){this.architecture=architecture;this.images={};}
  Scenes.prototype.image=function(key,path){
    if(!this.images[key]){var image=new Image();image.src=path;this.images[key]=image;}
    return this.images[key];
  };
  Scenes.prototype.day=function(id,base){
    base.sky=skies[id].map(function(c){return c.slice();});
    base.stage=id; base.r4={}; base.aboveClouds=base.galaxy=base.valleys=base.canyon=base.greek=0;
    base.snow=id==="snow"?1:0; base.rain=0; base.night=id==="moon-rome"?1:0;
    base.grass=base.grassMat=["hills","waterfalls","blossom"].indexOf(id)>=0?1:0;
    base.ground=id==="snow"?[170,188,204]:id==="moon-rome"?[34,43,64]:id==="sunset-rome"?[121,83,72]:id==="blossom"?[65,61,70]:[64,89,60];
    base.far=base.sky[2].slice();base.mid=base.sky[1].slice();base.near=base.sky[0].slice();
    base.cloud=id==="hills"?[230,238,231]:base.sky[2].slice();
    base.tint=[0,0,0];base.tintA=0;
    base.sun.a=id==="hills"?0.85:id==="blossom"?0.7:0;
    base.cycle=id==="hills"?0.34:id==="moon-rome"?0.02:0.60;
    return base;
  };
  Scenes.prototype.backdrop=function(g,o){
    if(o.id==="hills")return false;
    var image, w=o.width,h=o.height;
    if(o.id==="waterfalls")return this.architecture.waterfall(g,{
      image:this.image(h>w?"fallsPortrait":"falls",h>w?"v6-preview/assets/realm-waterfall-portrait-v1-native.png":"v6-preview/assets/realm-waterfall-v1-native.png"),
      width:w,height:h,portrait:h>w,scroll:Math.sin(o.metres*0.001)*180,opacity:1,time:o.time,reduced:o.reduced
    });
    g.save();g.imageSmoothingEnabled=false;
    var colors=skies[o.id];
    for(var y=0;y<h;y++){
      var t=y/h*3,index=Math.min(2,Math.floor(t)),f=t-index;
      var rgb=colors[index].map(function(v,i){return Math.round(v+(colors[index+1][i]-v)*f);});
      g.fillStyle="rgb("+rgb.join(",")+")";g.fillRect(0,y,w,1);
    }
    if(o.id==="moon-rome")image=this.image("moonRome","v6-preview/assets/realm-moon-rome-v1-native.png");
    if(o.id==="sunset-rome")image=this.image(h>w?"sunsetPortrait":"sunset",h>w?"v6-preview/assets/realm-sunset-rome-portrait-v1-native.png":"assets/greek-sunset-realm-px.png");
    if(o.id==="snow")image=this.image("snow","assets/snow-peaks-realm-px.png");
    if(o.id==="blossom")image=this.image(h>w?"blossomValley":"blossomWide",h>w?"v6-preview/assets/realm-blossom-valley-v1-native.png":"v6-preview/assets/realm-blossom-valley-wide-v1-native.png");
    if(image && image.complete && image.naturalWidth){
      var targetH=o.id==="blossom"?h*(h>w?1.6:1.3):h;
      var scale=Math.max(w/image.naturalWidth,targetH/image.naturalHeight)*1.05;
      var dw=Math.ceil(image.naturalWidth*scale),dh=Math.ceil(image.naturalHeight*scale);
      var x=Math.round((w-dw)*0.5+Math.sin(o.metres*0.0007)*(dw-w)*0.18);
      var top=Math.round((h-dh)*(o.id==="blossom"?0.53:0.4));
      if(o.id==="blossom")top=Math.round(h*0.42-dh*(h>w?0.61:0.56));
      g.drawImage(image,x,top,dw,dh);
    }
    g.restore();return true;
  };
  Scenes.prototype.cherryDepth=function(g,o){
    if(o.id!=="blossom")return;
    var image=this.image("cherry","v6-preview/assets/realm-cherry-tree-v1-native.png");
    var depth=o.foreground?1:0,spacing=o.foreground?o.width*2.4:80;
    var scroll=o.metres*(o.foreground?0.68:0.12);
    for(var i=Math.floor((scroll-o.width)/spacing);i<Math.ceil((scroll+o.width*2)/spacing);i++){
      var x=Math.round(i*spacing-scroll+(o.foreground?o.width*0.82:0));
      var size=o.foreground?o.height*0.95:78+(i%3+3)%3*16;
      var bottom=o.foreground?o.height*1.38:o.surface?o.surface(x+size*.52)+size*.045+3:o.height*.64;
      this.architecture.cherry(g,{image:image,x:x,bottom:bottom,
        size:size,time:o.time,seed:i*3.7,reduced:o.reduced});
    }
    if(depth)this.architecture.petals(g,o);
  };
  Scenes.prototype.weather=function(g,o){
    if(o.id!=="snow" || o.reduced)return;
    var force=Math.min(1,0.35+o.metres/2400), count=Math.round(44+force*56);
    g.save();
    for(var i=0;i<count;i++){
      var seed=Math.sin(i*127.1+9)*43758.5453; seed-=Math.floor(seed);
      var x=((seed*o.width-o.time*(18+force*28+i%7))%(o.width+12)+o.width+12)%(o.width+12)-6;
      var y=((i*31.73+o.time*(8+i%13))%(o.height+12))-6;
      g.fillStyle=i%3===0?"rgba(239,247,250,0.75)":"rgba(193,215,230,0.45)";
      g.fillRect(Math.round(x),Math.round(y),i%5===0?2:1,1);
      if(force>0.7 && i%3===0)g.fillRect(Math.round(x)+1,Math.round(y)-1,2,1);
    }
    g.restore();
  };
  root.SisyphusRealmScenes=Scenes;
})(window);
