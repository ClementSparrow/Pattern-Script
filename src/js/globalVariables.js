var unitTesting=false;
var curlevel=0;
var curlevelTarget=null;
var hasUsedCheckpoint=false;
var muted=0;
var runrulesonlevelstart_phase=false;

function doSetupTitleScreenLevelContinue(){
    try {
     	if (!!window.localStorage) { 
    		if (localStorage[document.URL]!==undefined) {
                if (localStorage[document.URL+'_checkpoint']!==undefined){
                    var backupStr = localStorage[document.URL+'_checkpoint'];
                    curlevelTarget = JSON.parse(backupStr);
                    
                    var arr = [];
                    for(var p in Object.keys(curlevelTarget.dat)) {
                        arr[p] = curlevelTarget.dat[p];
                    }
                    curlevelTarget.dat = new Int32Array(arr);

                }
    	        curlevel = localStorage[document.URL];            
    		}
    	}		 
    } catch(ex) {
    }
}

doSetupTitleScreenLevelContinue();


var verbose_logging=false;
var throttle_movement=false;
var cache_console_messages=false;
const deltatime = 17
var timer=0;
var repeatinterval=150;
var autotick=0;
var autotickinterval=0;
var winning=false;
var againing=false;
var againinterval=150;
var norepeat_action=false;
var oldflickscreendat=[];//used for buffering old flickscreen/scrollscreen positions, in case player vanishes
var keybuffer = [];

var restarting=false;

var level

var sprite_width = 5
var sprite_height = 5

