var unitTesting=false;
var curlevel=0;
var muted=0;

const storage_get = (key) => localStorage.getItem(key)
const storage_has = (key) => (localStorage.getItem(key) !== null)
const storage_set = (key, value) => localStorage.setItem(key, value)
const storage_remove = (key) => localStorage.removeItem(key)

var debug = false
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

var level

var sprite_width = 5
var sprite_height = 5

function clamp(min, value, max)
{
    return (value < max) ? ( (value < min) ? min : value ) : max
}