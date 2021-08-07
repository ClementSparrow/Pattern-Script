const SOUND_VOL = 0.25;
const SAMPLE_RATE = 5512;
const BIT_DEPTH = 8;

const SQUARE = 0;
const SAWTOOTH = 1;
const SINE = 2;
const NOISE = 3;
const TRIANGLE = 4;
const BREAKER = 5;

const SHAPES = [ 'square', 'sawtooth', 'sine', 'noise', 'triangle', 'breaker' ];

var AUDIO_CONTEXT;

// Since 2015, all navigators support AudioContext, but Safari used a prefix until 2021
function checkAudioContextExists()
{
	try
	{
		if (AUDIO_CONTEXT == null)
		{
			if (typeof AudioContext != 'undefined')
			{
				AUDIO_CONTEXT = new AudioContext();
			}
			else if (typeof webkitAudioContext != 'undefined')
			{
				AUDIO_CONTEXT = new webkitAudioContext();
			}
		}
	}
	catch (ex)
	{
		window.console.log(ex)
	}
}

checkAudioContextExists();

// Playback volume
const masterVolume = 1.0;


function SoundEffect(length, sample_rate)
{
	this._buffer = AUDIO_CONTEXT.createBuffer(1, length, sample_rate);
}

SoundEffect.prototype.getBuffer = function()
{
	return this._buffer.getChannelData(0);
}


//unlock bullshit
function ULBS()
{
	if (AUDIO_CONTEXT.state === 'suspended')
	{
		var unlock = function()
		{
			AUDIO_CONTEXT.resume().then(function()
				{
					document.body.removeEventListener('touchstart', unlock);
					document.body.removeEventListener('touchend', unlock);
					document.body.removeEventListener('mousedown', unlock);
					document.body.removeEventListener('mouseup', unlock);
					document.body.removeEventListener('keydown', unlock);
					document.body.removeEventListener('keyup', unlock);
				}
			);
		};

		document.body.addEventListener('touchstart', unlock, false);
		document.body.addEventListener('touchend', unlock, false);
		document.body.addEventListener('mousedown', unlock, false);
		document.body.addEventListener('mouseup', unlock, false);
		document.body.addEventListener('keydown', unlock, false);
		document.body.addEventListener('keyup', unlock, false);
	}
}

SoundEffect.prototype.play = function()
{
	ULBS();

	var source = AUDIO_CONTEXT.createBufferSource();
	var filter1 = AUDIO_CONTEXT.createBiquadFilter(); // defaults to lowpass filter. What's the use of having three of them?
	var filter2 = AUDIO_CONTEXT.createBiquadFilter();
	var filter3 = AUDIO_CONTEXT.createBiquadFilter();

	source.buffer = this._buffer;
	source.connect(filter1);

	filter1.frequency.value = 1600;
	filter2.frequency.value = 1600;
	filter3.frequency.value = 1600;

	filter1.connect(filter2);
	filter2.connect(filter3);
	filter3.connect(AUDIO_CONTEXT.destination);
	const t = AUDIO_CONTEXT.currentTime;
	if (typeof source.start != 'undefined')
	{
		source.start(t);
	} else {
		source.noteOn(t);
	}
	source.onended = function()
	{
		filter3.disconnect()
	}
}

SoundEffect.MIN_SAMPLE_RATE = 22050;

// redefine the SoundEffect class in case AudioContext is not supported by the browser
if (typeof AUDIO_CONTEXT == 'undefined')
{
	SoundEffect = function SoundEffect(length, sample_rate)
	{
		this._sample_rate = sample_rate;
		this._buffer = new Array(length);
		this._audioElement = null;
	}

	SoundEffect.prototype.getBuffer = function()
	{
		this._audioElement = null;
		return this._buffer;
	}

	SoundEffect.prototype.play = function()
	{
		if (this._audioElement)
		{
			this._audioElement.cloneNode(false).play();
		} else {
			for (var i = 0; i < this._buffer.length; i++)
			{
				// bit_depth is always 8, rescale [-1.0, 1.0) to [0, 256)
				this._buffer[i] = 255 & Math.floor(128 * clamp(0, this._buffer[i] + 1, 2));
			}
			var wav = MakeRiff(this._sample_rate, BIT_DEPTH, this._buffer);
			this._audioElement = new Audio();
			this._audioElement.src = wav.dataURI;
			this._audioElement.play();
		}
	}

	SoundEffect.MIN_SAMPLE_RATE = 1;
}


// ===== EFFECTS =====

// ----- TONE -----

/* Sets a variable base period for the generator */
function ToneEffect(sound_params)
{
	// parameters
	this.fperiod = 100.0 / (sound_params.p_base_freq * sound_params.p_base_freq + 0.001)
	this.fmaxperiod = 100.0 / (sound_params.p_freq_limit * sound_params.p_freq_limit + 0.001)
	this.stop_at_max = (sound_params.p_freq_limit > 0.0)
	this.fdslide = -Math.pow(sound_params.p_freq_dramp, 3.0) * 0.000001
	this.initial_fslide = 1.0 - Math.pow(sound_params.p_freq_ramp, 3.0) * 0.01

	// state
	this.reset()
}

ToneEffect.prototype.reset = function()
{
	this.fslide = this.initial_fslide;
}

ToneEffect.prototype.tick = function(fperiod)
{
	this.fslide += this.fdslide
	const result = fperiod * this.fslide
	if (result > this.fmaxperiod)
	{
		return this.fmaxperiod;
	}
	return result;
}


// ----- ARPEGIO -----

/* Arpegio: multiplies the base period of the sound by a given factor, only once, after a given delay. */
function ArpegioEffect(sound_params)
{
	// parameters
	this.mod = (sound_params.p_arp_mod >= 0.0) ? (1.0 - Math.pow(sound_params.p_arp_mod, 2.0) * 0.9) : (1.0 + Math.pow(sound_params.p_arp_mod, 2.0) * 10.0)
	this.limit = (sound_params.p_arp_speed == 1.0) ? 0 : (Math.floor(Math.pow(1.0 - sound_params.p_arp_speed, 2.0) * 20000 + 32))

	// state
	this.reset()
}

ArpegioEffect.prototype.reset = function()
{
	this.not_yet_triggered = true
}

ArpegioEffect.prototype.tick = function(fperiod, t)
{
	if (this.not_yet_triggered && t >= this.limit)
	{
		this.not_yet_triggered = false
		return fperiod * this.mod;
	}
	return fperiod;
}


// ----- VIBRATO -----

function VibratoEffect(sound_params)
{
	this.phase = 0.0
	this.speed = Math.pow(sound_params.p_vib_speed, 2.0) * 0.01
	this.amp = sound_params.p_vib_strength * 0.5
}

VibratoEffect.prototype.tick = function(fperiod)
{
	if (this.amp > 0.0)
	{
		this.phase += this.speed
		return fperiod * (1.0 + Math.sin(this.phase) * this.amp);
	}
	return fperiod;
}


// ----- Wave -----

function WaveFunction(sound_params)
{
	// parameters
	this.initial_square_duty = 0.5 - sound_params.p_duty * 0.5
	this.square_slide = -sound_params.p_duty_ramp * 0.00005
	const wave_type = sound_params.wave_type
	this.wave_type = wave_type
	this.is_noise = (wave_type === NOISE)
	const wave_functions = [ this.square, this.sawtooth, this.sine, this.noise, this.triangle, this.breaker ]
	if (wave_type in wave_functions)
	{
		this.wave_function = wave_functions[wave_type]
		this.wave_function.bind(this)
	}
	else
		throw new Exception('bad wave type! ' + wave_type);

	// state
	this.phase = 0
	if (this.is_noise)
	{
		this.noise_buffer = []
		this.generateNoiseBuffer()
	}
	this.reset()
}

WaveFunction.prototype.reset = function()
{
	this.square_duty = this.initial_square_duty
}

WaveFunction.prototype.generateNoiseBuffer = function()
{
	for (var i = 0; i < 32; ++i)
		this.noise_buffer[i] = Math.random() * 2.0 - 1.0
}

// TODO: once again it should be a modification of the 'square_duty' parameter
WaveFunction.prototype.tick = function()
{
	this.square_duty = clamp(0.0, this.square_duty + this.square_slide, 0.5)
}

WaveFunction.prototype.subtick = function(period)
{
	this.phase += 1;
	if (this.phase >= period)
	{
		this.phase %= period;
		if (this.is_noise)
		{
			this.generateNoiseBuffer()
		}
	}

	// Base waveform
	return this.wave_function(this.phase / period);
}

WaveFunction.prototype.square = function(fp) { return (fp < this.square_duty) ? 0.5 : -0.5; }
WaveFunction.prototype.sawtooth = (fp) => (1.0 - fp * 2)
WaveFunction.prototype.sine = (fp) => Math.sin(fp * 2 * Math.PI)
WaveFunction.prototype.noise = function(fp) { return this.noise_buffer[Math.floor(fp * 32)]; }
WaveFunction.prototype.triangle = (fp) => (Math.abs(1 - fp * 2) - 1)
WaveFunction.prototype.breaker = (fp) => (Math.abs(1 - fp * fp * 2) - 1)



// ----- Envelope -----

function EnvelopeEffect(sound_params)
{
	// state
	// this.vol = 0.0
	this.stage = 0
	this.time = 0

	// parameters
	this.length = [
		Math.floor(sound_params.p_env_attack * sound_params.p_env_attack * 100000.0),
		Math.floor(sound_params.p_env_sustain * sound_params.p_env_sustain * 100000.0),
		Math.floor(sound_params.p_env_decay * sound_params.p_env_decay * 100000.0)
	]
	this.total_length = this.length[0] + this.length[1] + this.length[2]
	this.punch = sound_params.p_env_punch
}

EnvelopeEffect.prototype.tick = function()
{
	this.time++
	if (this.time > this.length[this.stage])
	{
		this.time = 1;
		this.stage++;
		while (this.stage < 3 && this.length[this.stage] === 0) // skip stages of length 0
			this.stage++;
		if (this.stage === 3)
			return null;
	}
	if (this.stage === 0)
		return this.time / this.length[0];
	if (this.stage === 1)
		return 1.0 + Math.pow(1.0 - this.time / this.length[1], 1.0) * 2.0 * this.punch;
	// this.stage == 2
	return 1.0 - this.time / this.length[2];
}


// ----- Phaser -----

/* Adds a short-delay (normally in the same phase) repetition of the signal to itself, with a varying delay. */
function PhaserEffect(sound_params)
{
	// definition
	this.fdphase = Math.pow(sound_params.p_pha_ramp, 2.0) * 1.0;
	if (sound_params.p_pha_ramp < 0.0)
		this.fdphase = -this.fdphase;

	// state
	this.fphase = Math.pow(sound_params.p_pha_offset, 2.0) * 1020.0;
	if (sound_params.p_pha_offset < 0.0)
		this.fphase = -this.fphase;
	this.iphase = Math.abs(Math.floor(this.fphase));
	this.ipp = 0;
	this.buffer = Array(1024).fill(0.0);
}

// increases the delay. Should actually probably be a different effect affecting the parameter 'iphase' of the PhaserEffect. This would avoid the need to have a 'subtick' method.
PhaserEffect.prototype.tick = function()
{
	this.fphase += this.fdphase;
	this.iphase = Math.min(1023, Math.abs(Math.floor(this.fphase)))
}

PhaserEffect.prototype.subtick = function(sub_sample)
{
	this.buffer[this.ipp & 1023] = sub_sample
	const result = sub_sample + this.buffer[(this.ipp - this.iphase + 1024) & 1023]
	this.ipp = (this.ipp + 1) & 1023
	return result;
}


// ----- Frequency Filters -----

function FrequencyFilterEffect(sound_params)
{
	// Parameters of the low-pass filter
	this.w = Math.pow(sound_params.p_lpf_freq, 3.0) * 0.1;
	this.dmp = Math.min(0.8, 5.0 / (1.0 + Math.pow(sound_params.p_lpf_resonance, 2.0) * 20.0) * (0.01 + this.w) )

	// state of the low-pass filter
	this.p = 0.0
	this.dp = 0.0

	// Parameters of the high-pass filter
	this.hp = Math.pow(sound_params.p_hpf_freq, 2.0) * 0.1;

	// state of the high-pass filter
	this.php = 0.0;

	// parameters for the variation of the actual parameters (should be treated as an effect affecting the parameters)
	this.w_d = 1.0 + sound_params.p_lpf_ramp * 0.0001;
	this.hp_d = 1.0 + sound_params.p_hpf_ramp * 0.0003;
	this.do_lowpass = (sound_params.p_lpf_freq != 1.0)
}

// increases or decreases the high pass filter strength. Should actually probably be a different effect affecting the parameter 'hp' of the FrequencyFilterEffect.
// This would avoid the need to have a 'subtick' method.
FrequencyFilterEffect.prototype.tick = function()
{
	if (this.hp_d != 0.0)
	{
		this.hp = clamp(0.00001, this.hp*this.hp_d, 0.1)
	}
}

FrequencyFilterEffect.prototype.subtick = function(sub_sample)
{
	const pp = this.p

	// Low-pass filter
	this.w = clamp(0.0, this.w * this.w_d, 0.1)
	if (this.do_lowpass)
	{
		this.dp += (sub_sample - this.p) * this.w
		this.dp -= this.dp * this.dmp
		this.p += this.dp
	}
	else
	{
		this.p = sub_sample
		this.dp = 0.0
	}

	// High-pass filter
	this.php += this.p - pp;
	this.php -= this.php * this.hp;
	return this.php;
}


// ===== GENERATE SOUND =====

SoundEffect.generate = function(ps)
{
/*  window.console.log(ps.wave_type + "\t" + ps.seed);

	var psstring="";
	for (var n in ps) {
		if (ps.hasOwnProperty(n)) {
			psstring = psstring +"result." + n+" = " + ps[n] + ";\n";
		}
	}
window.console.log(ps);
window.console.log(psstring);*/
	function repeat()
	{
		rep_time = 0;

		tone.reset()
		fperiod = tone.fperiod // TODO: we actually have a feedback loop, and should deal with it as such.
		period = Math.floor(fperiod)

		generator.reset()

		arpegio.reset() // should not change anything to comment that, because the effect is only activated once at a fixed time, even when there are repetitions.
	};

	var rep_time;
	var period;

	var tone = new ToneEffect(ps)
	var arpegio = new ArpegioEffect(ps)
	var vibrato = new VibratoEffect(ps)

	var generator = new WaveFunction(ps)
	var freq_filter = new FrequencyFilterEffect(ps)
	var envelope = new EnvelopeEffect(ps)
	var phaser = new PhaserEffect(ps)

	repeat();  // First time through, this is a bit of a misnomer

	// Repeat
	var rep_limit = Math.floor(Math.pow(1.0 - ps.p_repeat_speed, 2.0) * 20000
														 + 32);
	if (ps.p_repeat_speed == 0.0)
		rep_limit = 0;

	//var gain = 2.0 * Math.log(1 + (Math.E - 1) * ps.sound_vol);
	var gain = 2.0 * ps.sound_vol;
	var gain = Math.exp(ps.sound_vol) - 1;

	var num_clipped = 0;

	// ...end of initialization. Generate samples.

	// downsampler effect
	var sample_sum = 0;
	var num_summed = 0;
	var summands = Math.floor(44100 / ps.sample_rate);

	var buffer_i = 0;
	var buffer_length = Math.ceil(envelope.total_length / summands);

	var sound;
	if (ps.sample_rate < SoundEffect.MIN_SAMPLE_RATE) {
		// Assume 4x gets close enough to MIN_SAMPLE_RATE
		sound = new SoundEffect(4 * buffer_length, SoundEffect.MIN_SAMPLE_RATE);
	} else {
		sound = new SoundEffect(buffer_length, ps.sample_rate)
	}
	var buffer = sound.getBuffer();

	for (var t = 0; ; ++t)
	{

		// Repeats
		if (rep_limit != 0 && ++rep_time >= rep_limit)
			repeat();

		// Arpeggio (single)
		fperiod = arpegio.tick(fperiod, t) // TODO: fperiod is actually a member of ToneEffect

		// Frequency slide, and frequency slide slide!
		fperiod = tone.tick(fperiod)

		// Vibrato
		var rfperiod = vibrato.tick(fperiod)

		period = Math.max(8, Math.floor(rfperiod)) // period should be at least 8 because of the 8x supersampling

		generator.tick()

		// Volume envelope
		env_vol = envelope.tick()
		if (env_vol === null)
			break;

		// Phaser step
		phaser.tick()

		freq_filter.tick()

		// 8x supersampling
		var sample = 0.0;
		for (var si = 0; si < 8; ++si)
		{
			var sub_sample = generator.subtick(period)

			// Low-pass and High-pass filter
			sub_sample = freq_filter.subtick(sub_sample)

			// Phaser
			sub_sample = phaser.subtick(sub_sample)

			// final accumulation
			sample += sub_sample;
		}

		// envelope application
		sample *= env_vol;

		// Accumulate samples appropriately for sample rate
		sample_sum += sample;
		if (++num_summed < summands)
			continue;

		num_summed = 0;
		sample = sample_sum / summands;
		sample_sum = 0;

		sample = sample / 8 * masterVolume;
		sample *= gain;

		buffer[buffer_i++] = sample;

		if (ps.sample_rate < SoundEffect.MIN_SAMPLE_RATE) {
			buffer[buffer_i++] = sample;
			buffer[buffer_i++] = sample;
			buffer[buffer_i++] = sample;
		}
	}

	if (summands > 0) {
		sample = sample_sum / summands;

		sample = sample / 8 * masterVolume;
		sample *= gain;

		buffer[buffer_i++] = sample;

		if (ps.sample_rate < SoundEffect.MIN_SAMPLE_RATE) {
			buffer[buffer_i++] = sample;
			buffer[buffer_i++] = sample;
			buffer[buffer_i++] = sample;
		}
	}

	return sound;
};

if (typeof exports != 'undefined') {
	// For node.js
	var RIFFWAVE = require('./riffwave').RIFFWAVE;
	exports.Params = Params;
	exports.generate = generate;
}

var sfxCache = {};
var cachedSeeds = [];
var CACHE_MAX = 50;

function cacheSeed(seed){
	if (seed in sfxCache) {
		return sfxCache[seed];
	}

	var params = generateFromSeed(seed);
	params.sound_vol = SOUND_VOL;
	params.sample_rate = SAMPLE_RATE;
	params.bit_depth = BIT_DEPTH;

	var sound = SoundEffect.generate(params);
	sfxCache[seed] = sound;
	cachedSeeds.push(seed);

	while (cachedSeeds.length>CACHE_MAX) {
		var toRemove=cachedSeeds[0];
		cachedSeeds = cachedSeeds.slice(1);
		delete sfxCache[toRemove];
	}

	return sound;
}


function playSound(seed) {
	if (muted){
		return;
	}
	checkAudioContextExists();
	if (unitTesting) return;
	cacheSeed(seed).play();
}



function killAudioButton(){
	var mb = document.getElementById("muteButton");
	var umb = document.getElementById("unMuteButton");
	if (mb){
		mb.remove();
		umb.remove();
	}
}

function showAudioButton(){
	var mb = document.getElementById("muteButton");
	var umb = document.getElementById("unMuteButton");
	if (mb){
		mb.style.display="block"; 
		umb.style.display="none";
	}
}


function toggleMute() {
	if (muted===0){
		muteAudio();
	} else {
		unMuteAudio();
	}
}

function muteAudio() {
	muted=1; 
	tryDeactivateYoutube();
	var mb = document.getElementById("muteButton");
	var umb = document.getElementById("unMuteButton");
	if (mb){
		mb.style.display="none"; 
		umb.style.display="block";
	}
}
function unMuteAudio() {
	muted=0; 
	tryActivateYoutube();
	var mb = document.getElementById("muteButton");
	var umb = document.getElementById("unMuteButton");
	if (mb){
		mb.style.display="block"; 
		umb.style.display="none";
	}
}