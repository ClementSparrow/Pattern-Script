var unitTesting=false;
var curlevel=0;
var curlevelTarget = null
var muted=0;
var runrulesonlevelstart_phase=false;

const storage_get = (key) => localStorage.getItem(key)
const storage_has = (key) => (localStorage.getItem(key) !== null)
const storage_set = (key, value) => localStorage.setItem(key, value)
const storage_remove = (key) => localStorage.removeItem(key)

function doSetupTitleScreenLevelContinue()
{
	try {
		if (storage_has(document.URL))
		{
			if (storage_has(document.URL+'_checkpoint'))
			{
				curlevelTarget = JSON.parse(storage_get(document.URL+'_checkpoint'))

				var arr = []
				for(var p in Object.keys(curlevelTarget.dat))
				{
					arr[p] = curlevelTarget.dat[p]
				}
				curlevelTarget.dat = new Int32Array(arr)
			}
			curlevel = storage_get(document.URL)
		}
	} catch(ex) { }
}

doSetupTitleScreenLevelContinue()


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
var keybuffer = []

var restarting=false;

var level

var sprite_width = 5
var sprite_height = 5

function clamp(min, value, max)
{
    return (value < max) ? ( (value < min) ? min : value ) : max
}