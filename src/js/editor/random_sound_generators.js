
// ===== RANDOM SOUND GENERATORS =====

// These functions are used by the shound toolbar to generate the sound parameters from a seed,
// but they are also used in the engine by the function that plays the sound from its seed.
// It would be much better if the engine used the sound parameters generated from the seed, and avoided using the functions below.
// Indeed, they take a lot of place in the final game's code but are only useful from the point of view of the game's editor.

// Sound generation parameters are on [0,1] unless noted SIGNED, & thus [-1,1]
function Params()
{
	return {
		// Wave shape
		wave_type: SQUARE,

		// Envelope
		p_env_attack: 0.0,   // Attack time
		p_env_sustain: 0.3,  // Sustain time
		p_env_punch: 0.0,    // Sustain punch
		p_env_decay: 0.4,    // Decay time

		// Tone
		p_base_freq: 0.3,    // Start frequency
		p_freq_limit: 0.0,   // Min frequency cutoff
		p_freq_ramp: 0.0,    // Slide (SIGNED)
		p_freq_dramp: 0.0,   // Delta slide (SIGNED)
		// Vibrato
		p_vib_strength: 0.0, // Vibrato depth
		p_vib_speed: 0.0,    // Vibrato speed

		// Tonal change
		p_arp_mod: 0.0,      // Change amount (SIGNED)
		p_arp_speed: 0.0,    // Change speed

		// Duty (for square waves only, the value of the phase at which the waves goes back to zero)
		p_duty: 0.0,         // Square duty
		p_duty_ramp: 0.0,    // Duty sweep (SIGNED)

		// Repeat
		p_repeat_speed: 0.0, // Repeat speed

		// Phaser
		p_pha_offset: 0.0,   // Phaser offset (SIGNED)
		p_pha_ramp: 0.0,     // Phaser sweep (SIGNED)

		// Low-pass filter
		p_lpf_freq: 1.0,     // Low-pass filter cutoff
		p_lpf_ramp: 0.0,     // Low-pass filter cutoff sweep (SIGNED)
		p_lpf_resonance: 0.0,// Low-pass filter resonance
		// High-pass filter
		p_hpf_freq: 0.0,     // High-pass filter cutoff
		p_hpf_ramp: 0.0,     // High-pass filter cutoff sweep (SIGNED)

		// Sample parameters
		sound_vol: 0.5,
		sample_rate: 44100,
		bit_depth: 8,
	};
}

// These functions are only used in the generators bellow
var rng;
var seeded = false;
function frnd(range)
{
	return range * ((seeded) ? rng.uniform() : Math.random());
}

function rnd(max)
{
	return Math.floor( (max + 1) * ((seeded) ? rng.uniform() : Math.random()) );
}


pickupCoin = function()
{
	var result = Params();
	result.wave_type = Math.floor(frnd(SHAPES.length));
	if (result.wave_type === 3)
	{
		result.wave_type = 0;
	}
	result.p_base_freq = 0.4 + frnd(0.5);
	result.p_env_attack = 0.0;
	result.p_env_sustain = frnd(0.1);
	result.p_env_decay = 0.1 + frnd(0.4);
	result.p_env_punch = 0.3 + frnd(0.3);
	if (rnd(1))
	{
		result.p_arp_speed = 0.5 + frnd(0.2);
		var num = (frnd(7) | 1) + 1;
		var den = num + (frnd(7) | 1) + 2;
		result.p_arp_mod = (+num) / (+den); //0.2 + frnd(0.4);
	}
	return result;
};


laserShoot = function() {
	var result=Params();
	result.wave_type = rnd(2);
	if (result.wave_type === SINE && rnd(1))
		result.wave_type = rnd(1);
	result.wave_type = Math.floor(frnd(SHAPES.length));

	if (result.wave_type === 3) {
		result.wave_type = SQUARE;
	}

	result.p_base_freq = 0.5 + frnd(0.5);
	result.p_freq_limit = result.p_base_freq - 0.2 - frnd(0.6);
	if (result.p_freq_limit < 0.2) result.p_freq_limit = 0.2;
	result.p_freq_ramp = -0.15 - frnd(0.2);
	if (rnd(2) === 0)
	{
		result.p_base_freq = 0.3 + frnd(0.6);
		result.p_freq_limit = frnd(0.1);
		result.p_freq_ramp = -0.35 - frnd(0.3);
	}
	if (rnd(1))
	{
		result.p_duty = frnd(0.5);
		result.p_duty_ramp = frnd(0.2);
	}
	else
	{
		result.p_duty = 0.4 + frnd(0.5);
		result.p_duty_ramp = -frnd(0.7);
	}
	result.p_env_attack = 0.0;
	result.p_env_sustain = 0.1 + frnd(0.2);
	result.p_env_decay = frnd(0.4);
	if (rnd(1))
		result.p_env_punch = frnd(0.3);
	if (rnd(2) === 0)
	{
		result.p_pha_offset = frnd(0.2);
		result.p_pha_ramp = -frnd(0.2);
	}
	if (rnd(1))
		result.p_hpf_freq = frnd(0.3);

	return result;
};

explosion = function() {
	var result=Params();

	if (rnd(1)) {
		result.p_base_freq = 0.1 + frnd(0.4);
		result.p_freq_ramp = -0.1 + frnd(0.4);
	} else {
		result.p_base_freq = 0.2 + frnd(0.7);
		result.p_freq_ramp = -0.2 - frnd(0.2);
	}
	result.p_base_freq *= result.p_base_freq;
	if (rnd(4) === 0)
		result.p_freq_ramp = 0.0;
	if (rnd(2) === 0)
		result.p_repeat_speed = 0.3 + frnd(0.5);
	result.p_env_attack = 0.0;
	result.p_env_sustain = 0.1 + frnd(0.3);
	result.p_env_decay = frnd(0.5);
	if (rnd(1) === 0) {
		result.p_pha_offset = -0.3 + frnd(0.9);
		result.p_pha_ramp = -frnd(0.3);
	}
	result.p_env_punch = 0.2 + frnd(0.6);
	if (rnd(1)) {
		result.p_vib_strength = frnd(0.7);
		result.p_vib_speed = frnd(0.6);
	}
	if (rnd(2) === 0) {
		result.p_arp_speed = 0.6 + frnd(0.3);
		result.p_arp_mod = 0.8 - frnd(1.6);
	}

	return result;
};

birdSound = function()
{
	var result = Params();

	if (frnd(10) < 1)
	{
		result.wave_type = Math.floor(frnd(SHAPES.length));
		if (result.wave_type === 3)
		{
			result.wave_type = SQUARE;
		}
		result.p_env_attack = 0.4304400932967592 + frnd(0.2) - 0.1;
		result.p_env_sustain = 0.15739346034252394 + frnd(0.2) - 0.1;
		result.p_env_punch = 0.004488201744871758 + frnd(0.2) - 0.1;
		result.p_env_decay = 0.07478075528212291 + frnd(0.2) - 0.1;
		result.p_base_freq = 0.9865265720147687 + frnd(0.2) - 0.1;
		result.p_freq_limit = 0 + frnd(0.2) - 0.1;
		result.p_freq_ramp = -0.2995018224359539 + frnd(0.2) - 0.1;
		if (frnd(1.0) < 0.5)
		{
			result.p_freq_ramp = 0.1 + frnd(0.15);
		}
		result.p_freq_dramp = 0.004598608156964473 + frnd(0.1) - 0.05;
		result.p_vib_strength = -0.2202799497929496 + frnd(0.2) - 0.1;
		result.p_vib_speed = 0.8084998703158364 + frnd(0.2) - 0.1;
		result.p_arp_mod = 0;//-0.46410459213693644+frnd(0.2)-0.1;
		result.p_arp_speed = 0;//-0.10955361249587248+frnd(0.2)-0.1;
		result.p_duty = -0.9031808754347107 + frnd(0.2) - 0.1;
		result.p_duty_ramp = -0.8128699999808343 + frnd(0.2) - 0.1;
		result.p_repeat_speed = 0.6014860189319991 + frnd(0.2) - 0.1;
		result.p_pha_offset = -0.9424902314367765 + frnd(0.2) - 0.1;
		result.p_pha_ramp = -0.1055482222272056 + frnd(0.2) - 0.1;
		result.p_lpf_freq = 0.9989765717851521 + frnd(0.2) - 0.1;
		result.p_lpf_ramp = -0.25051720626043017 + frnd(0.2) - 0.1;
		result.p_lpf_resonance = 0.32777871505494693 + frnd(0.2) - 0.1;
		result.p_hpf_freq = 0.0023548750981756753 + frnd(0.2) - 0.1;
		result.p_hpf_ramp = -0.002375673204842568 + frnd(0.2) - 0.1;
		return result;
	}

	if (frnd(10) < 1)
	{
		result.wave_type = Math.floor(frnd(SHAPES.length));
		if (result.wave_type === 3)
		{
			result.wave_type = SQUARE;
		}
		result.p_env_attack = 0.5277795946672003 + frnd(0.2) - 0.1;
		result.p_env_sustain = 0.18243733568468432 + frnd(0.2) - 0.1;
		result.p_env_punch = -0.020159754546840117 + frnd(0.2) - 0.1;
		result.p_env_decay = 0.1561353422051903 + frnd(0.2) - 0.1;
		result.p_base_freq = 0.9028855606533718 + frnd(0.2) - 0.1;
		result.p_freq_limit = -0.008842787837148716;
		result.p_freq_ramp = -0.1;
		result.p_freq_dramp = -0.012891241489551925;
		result.p_vib_strength = -0.17923136138403065 + frnd(0.2) - 0.1;
		result.p_vib_speed = 0.908263385610142 + frnd(0.2) - 0.1;
		result.p_arp_mod = 0.41690153355414894 + frnd(0.2) - 0.1;
		result.p_arp_speed = 0.0010766233195860703 + frnd(0.2) - 0.1;
		result.p_duty = -0.8735363011184684 + frnd(0.2) - 0.1;
		result.p_duty_ramp = -0.7397985366747507 + frnd(0.2) - 0.1;
		result.p_repeat_speed = 0.0591789344172107 + frnd(0.2) - 0.1;
		result.p_pha_offset = -0.9961184222777699 + frnd(0.2) - 0.1;
		result.p_pha_ramp = -0.08234769395850523 + frnd(0.2) - 0.1;
		result.p_lpf_freq = 0.9412475115697335 + frnd(0.2) - 0.1;
		result.p_lpf_ramp = -0.18261358925834958 + frnd(0.2) - 0.1;
		result.p_lpf_resonance = 0.24541438107389477 + frnd(0.2) - 0.1;
		result.p_hpf_freq = -0.01831940280978611 + frnd(0.2) - 0.1;
		result.p_hpf_ramp = -0.03857383633171346 + frnd(0.2) - 0.1;
		return result;
	}
	
	if (frnd(10) < 1)
	{
		//result.wave_type = 4;
		result.wave_type = Math.floor(frnd(SHAPES.length));

		if (result.wave_type === 3)
		{
			result.wave_type = SQUARE;
		}
		result.p_env_attack = 0.4304400932967592 + frnd(0.2) - 0.1;
		result.p_env_sustain = 0.15739346034252394 + frnd(0.2) - 0.1;
		result.p_env_punch = 0.004488201744871758 + frnd(0.2) - 0.1;
		result.p_env_decay = 0.07478075528212291 + frnd(0.2) - 0.1;
		result.p_base_freq = 0.9865265720147687 + frnd(0.2) - 0.1;
		result.p_freq_limit = 0 + frnd(0.2) - 0.1;
		result.p_freq_ramp = -0.2995018224359539 + frnd(0.2) - 0.1;
		result.p_freq_dramp = 0.004598608156964473 + frnd(0.2) - 0.1;
		result.p_vib_strength = -0.2202799497929496 + frnd(0.2) - 0.1;
		result.p_vib_speed = 0.8084998703158364 + frnd(0.2) - 0.1;
		result.p_arp_mod = -0.46410459213693644 + frnd(0.2) - 0.1;
		result.p_arp_speed = -0.10955361249587248 + frnd(0.2) - 0.1;
		result.p_duty = -0.9031808754347107 + frnd(0.2) - 0.1;
		result.p_duty_ramp = -0.8128699999808343 + frnd(0.2) - 0.1;
		result.p_repeat_speed = 0.7014860189319991 + frnd(0.2) - 0.1;
		result.p_pha_offset = -0.9424902314367765 + frnd(0.2) - 0.1;
		result.p_pha_ramp = -0.1055482222272056 + frnd(0.2) - 0.1;
		result.p_lpf_freq = 0.9989765717851521 + frnd(0.2) - 0.1;
		result.p_lpf_ramp = -0.25051720626043017 + frnd(0.2) - 0.1;
		result.p_lpf_resonance = 0.32777871505494693 + frnd(0.2) - 0.1;
		result.p_hpf_freq = 0.0023548750981756753 + frnd(0.2) - 0.1;
		result.p_hpf_ramp = -0.002375673204842568 + frnd(0.2) - 0.1;
		return result;
	}

	if (frnd(5) > 1)
	{
		result.wave_type = Math.floor(frnd(SHAPES.length));

		if (result.wave_type === 3)
		{
			result.wave_type = SQUARE;
		}
		if (rnd(1))
		{
			result.p_arp_mod = 0.2697849293151393 + frnd(0.2) - 0.1;
			result.p_arp_speed = -0.3131172257760948 + frnd(0.2) - 0.1;
			result.p_base_freq = 0.8090588299313949 + frnd(0.2) - 0.1;
			result.p_duty = -0.6210022920964955 + frnd(0.2) - 0.1;
			result.p_duty_ramp = -0.00043441813553182567 + frnd(0.2) - 0.1;
			result.p_env_attack = 0.004321877246874195 + frnd(0.2) - 0.1;
			result.p_env_decay = 0.1 + frnd(0.2) - 0.1;
			result.p_env_punch = 0.061737781504416146 + frnd(0.2) - 0.1;
			result.p_env_sustain = 0.4987252564798832 + frnd(0.2) - 0.1;
			result.p_freq_dramp = 0.31700340314222614 + frnd(0.2) - 0.1;
			result.p_freq_limit = 0 + frnd(0.2) - 0.1;
			result.p_freq_ramp = -0.163380391341416 + frnd(0.2) - 0.1;
			result.p_hpf_freq = 0.4709005021145149 + frnd(0.2) - 0.1;
			result.p_hpf_ramp = 0.6924667290539194 + frnd(0.2) - 0.1;
			result.p_lpf_freq = 0.8351398631384511 + frnd(0.2) - 0.1;
			result.p_lpf_ramp = 0.36616557192873134 + frnd(0.2) - 0.1;
			result.p_lpf_resonance = -0.08685777111664439 + frnd(0.2) - 0.1;
			result.p_pha_offset = -0.036084571580025544 + frnd(0.2) - 0.1;
			result.p_pha_ramp = -0.014806445085568108 + frnd(0.2) - 0.1;
			result.p_repeat_speed = -0.8094368475518489 + frnd(0.2) - 0.1;
			result.p_vib_speed = 0.4496665457171294 + frnd(0.2) - 0.1;
			result.p_vib_strength = 0.23413762515532424 + frnd(0.2) - 0.1;
		}
		else
		{
			result.p_arp_mod = -0.35697118026766184 + frnd(0.2) - 0.1;
			result.p_arp_speed = 0.3581140690559588 + frnd(0.2) - 0.1;
			result.p_base_freq = 1.3260897696157528 + frnd(0.2) - 0.1;
			result.p_duty = -0.30984900436710694 + frnd(0.2) - 0.1;
			result.p_duty_ramp = -0.0014374759133411626 + frnd(0.2) - 0.1;
			result.p_env_attack = 0.3160357835682254 + frnd(0.2) - 0.1;
			result.p_env_decay = 0.1 + frnd(0.2) - 0.1;
			result.p_env_punch = 0.24323114016870148 + frnd(0.2) - 0.1;
			result.p_env_sustain = 0.4 + frnd(0.2) - 0.1;
			result.p_freq_dramp = 0.2866475886237244 + frnd(0.2) - 0.1;
			result.p_freq_limit = 0 + frnd(0.2) - 0.1;
			result.p_freq_ramp = -0.10956352368742976 + frnd(0.2) - 0.1;
			result.p_hpf_freq = 0.20772718017889846 + frnd(0.2) - 0.1;
			result.p_hpf_ramp = 0.1564090637378835 + frnd(0.2) - 0.1;
			result.p_lpf_freq = 0.6021372770637031 + frnd(0.2) - 0.1;
			result.p_lpf_ramp = 0.24016227139979027 + frnd(0.2) - 0.1;
			result.p_lpf_resonance = -0.08787383821160144 + frnd(0.2) - 0.1;
			result.p_pha_offset = -0.381597686151701 + frnd(0.2) - 0.1;
			result.p_pha_ramp = -0.0002481687661373495 + frnd(0.2) - 0.1;
			result.p_repeat_speed = 0.07812112809425686 + frnd(0.2) - 0.1;
			result.p_vib_speed = -0.13648848579133943 + frnd(0.2) - 0.1;
			result.p_vib_strength = 0.0018874158972302657 + frnd(0.2) - 0.1;
		}
		return result;
	}

	result.wave_type = Math.floor(frnd(SHAPES.length));//TRIANGLE;
	if (result.wave_type === 1 || result.wave_type === 3)
	{
		result.wave_type = 2;
	}
	result.p_base_freq = 0.85 + frnd(0.15);
	result.p_freq_ramp = 0.3 + frnd(0.15);
	//  result.p_freq_dramp = 0.3+frnd(2.0);

	result.p_env_attack = 0 + frnd(0.09);
	result.p_env_sustain = 0.2 + frnd(0.3);
	result.p_env_decay = 0 + frnd(0.1);

	result.p_duty = frnd(2.0) - 1.0;
	result.p_duty_ramp = Math.pow(frnd(2.0) - 1.0, 3.0);

	result.p_repeat_speed = 0.5 + frnd(0.1);

	result.p_pha_offset = -0.3 + frnd(0.9);
	result.p_pha_ramp = -frnd(0.3);

	result.p_arp_speed = 0.4 + frnd(0.6);
	result.p_arp_mod = 0.8 + frnd(0.1);

	result.p_lpf_resonance = frnd(2.0) - 1.0;
	result.p_lpf_freq = 1.0 - Math.pow(frnd(1.0), 3.0);
	result.p_lpf_ramp = Math.pow(frnd(2.0) - 1.0, 3.0);
	if (result.p_lpf_freq < 0.1 && result.p_lpf_ramp < -0.05)
	{
		result.p_lpf_ramp = -result.p_lpf_ramp;
	}
	result.p_hpf_freq = Math.pow(frnd(1.0), 5.0);
	result.p_hpf_ramp = Math.pow(frnd(2.0) - 1.0, 5.0);

	return result;
}


pushSound = function() {
	var result=Params();
	result.wave_type = Math.floor(frnd(SHAPES.length));//TRIANGLE;
	if (result.wave_type === 2) {
		result.wave_type++;
	}
	if (result.wave_type === 0) {
		result.wave_type = NOISE;
	}
	//new
	result.p_base_freq = 0.1 + frnd(0.4);
	result.p_freq_ramp = 0.05 + frnd(0.2);

	result.p_env_attack = 0.01 + frnd(0.09);
	result.p_env_sustain = 0.01 + frnd(0.09);
	result.p_env_decay = 0.01 + frnd(0.09);

	result.p_repeat_speed = 0.3 + frnd(0.5);
	result.p_pha_offset = -0.3 + frnd(0.9);
	result.p_pha_ramp = -frnd(0.3);
	result.p_arp_speed = 0.6 + frnd(0.3);
	result.p_arp_mod = 0.8 - frnd(1.6);

	return result;
};



powerUp = function() {
	var result=Params();
	if (rnd(1))
		result.wave_type = SAWTOOTH;
	else
		result.p_duty = frnd(0.6);
	result.wave_type = Math.floor(frnd(SHAPES.length));
	if (result.wave_type === 3) {
		result.wave_type = SQUARE;
	}
	if (rnd(1))
	{
		result.p_base_freq = 0.2 + frnd(0.3);
		result.p_freq_ramp = 0.1 + frnd(0.4);
		result.p_repeat_speed = 0.4 + frnd(0.4);
	}
	else
	{
		result.p_base_freq = 0.2 + frnd(0.3);
		result.p_freq_ramp = 0.05 + frnd(0.2);
		if (rnd(1))
		{
			result.p_vib_strength = frnd(0.7);
			result.p_vib_speed = frnd(0.6);
		}
	}
	result.p_env_attack = 0.0;
	result.p_env_sustain = frnd(0.4);
	result.p_env_decay = 0.1 + frnd(0.4);

	return result;
};

hitHurt = function() {
	result = Params();
	result.wave_type = rnd(2);
	if (result.wave_type === SINE)
		result.wave_type = NOISE;
	if (result.wave_type === SQUARE)
		result.p_duty = frnd(0.6);
	result.wave_type = Math.floor(frnd(SHAPES.length));
	result.p_base_freq = 0.2 + frnd(0.6);
	result.p_freq_ramp = -0.3 - frnd(0.4);
	result.p_env_attack = 0.0;
	result.p_env_sustain = frnd(0.1);
	result.p_env_decay = 0.1 + frnd(0.2);
	if (rnd(1))
		result.p_hpf_freq = frnd(0.3);
	return result;
};


jump = function() {
	result = Params();
	result.wave_type = SQUARE;
	result.wave_type = Math.floor(frnd(SHAPES.length));
	if (result.wave_type === 3) {
		result.wave_type = SQUARE;
	}
	result.p_duty = frnd(0.6);
	result.p_base_freq = 0.3 + frnd(0.3);
	result.p_freq_ramp = 0.1 + frnd(0.2);
	result.p_env_attack = 0.0;
	result.p_env_sustain = 0.1 + frnd(0.3);
	result.p_env_decay = 0.1 + frnd(0.2);
	if (rnd(1))
		result.p_hpf_freq = frnd(0.3);
	if (rnd(1))
		result.p_lpf_freq = 1.0 - frnd(0.6);
	return result;
};

blipSelect = function() {
	result = Params();
	result.wave_type = rnd(1);
	result.wave_type = Math.floor(frnd(SHAPES.length));
	if (result.wave_type === 3) {
		result.wave_type = rnd(1);
	}
	if (result.wave_type === SQUARE)
		result.p_duty = frnd(0.6);
	result.p_base_freq = 0.2 + frnd(0.4);
	result.p_env_attack = 0.0;
	result.p_env_sustain = 0.1 + frnd(0.1);
	result.p_env_decay = frnd(0.2);
	result.p_hpf_freq = 0.1;
	return result;
};

random = function() {
	result = Params();
	result.wave_type = Math.floor(frnd(SHAPES.length));
	result.p_base_freq = Math.pow(frnd(2.0) - 1.0, 2.0);
	if (rnd(1))
		result.p_base_freq = Math.pow(frnd(2.0) - 1.0, 3.0) + 0.5;
	result.p_freq_limit = 0.0;
	result.p_freq_ramp = Math.pow(frnd(2.0) - 1.0, 5.0);
	if (result.p_base_freq > 0.7 && result.p_freq_ramp > 0.2)
		result.p_freq_ramp = -result.p_freq_ramp;
	if (result.p_base_freq < 0.2 && result.p_freq_ramp < -0.05)
		result.p_freq_ramp = -result.p_freq_ramp;
	result.p_freq_dramp = Math.pow(frnd(2.0) - 1.0, 3.0);
	result.p_duty = frnd(2.0) - 1.0;
	result.p_duty_ramp = Math.pow(frnd(2.0) - 1.0, 3.0);
	result.p_vib_strength = Math.pow(frnd(2.0) - 1.0, 3.0);
	result.p_vib_speed = frnd(2.0) - 1.0;
	result.p_env_attack = Math.pow(frnd(2.0) - 1.0, 3.0);
	result.p_env_sustain = Math.pow(frnd(2.0) - 1.0, 2.0);
	result.p_env_decay = frnd(2.0) - 1.0;
	result.p_env_punch = Math.pow(frnd(0.8), 2.0);
	if (result.p_env_attack + result.p_env_sustain + result.p_env_decay < 0.2) {
		result.p_env_sustain += 0.2 + frnd(0.3);
		result.p_env_decay += 0.2 + frnd(0.3);
	}
	result.p_lpf_resonance = frnd(2.0) - 1.0;
	result.p_lpf_freq = 1.0 - Math.pow(frnd(1.0), 3.0);
	result.p_lpf_ramp = Math.pow(frnd(2.0) - 1.0, 3.0);
	if (result.p_lpf_freq < 0.1 && result.p_lpf_ramp < -0.05)
		result.p_lpf_ramp = -result.p_lpf_ramp;
	result.p_hpf_freq = Math.pow(frnd(1.0), 5.0);
	result.p_hpf_ramp = Math.pow(frnd(2.0) - 1.0, 5.0);
	result.p_pha_offset = Math.pow(frnd(2.0) - 1.0, 3.0);
	result.p_pha_ramp = Math.pow(frnd(2.0) - 1.0, 3.0);
	result.p_repeat_speed = frnd(2.0) - 1.0;
	result.p_arp_speed = frnd(2.0) - 1.0;
	result.p_arp_mod = frnd(2.0) - 1.0;
	return result;
};

const generators = [
	pickupCoin,
	laserShoot,
	explosion,
	powerUp,
	hitHurt,
	jump,
	blipSelect,
	pushSound,
	random,
	birdSound
]

const generatorNames = [
	'pickupCoin',
	'laserShoot',
	'explosion',
	'powerUp',
	'hitHurt',
	'jump',
	'blipSelect',
	'pushSound',
	'random',
	'birdSound'
]

generateFromSeed = function(seed)
{
	rng = new RNG( (seed / 100) | 0 );
	const generatorindex = seed % 100;
	var soundGenerator = generators[generatorindex % generators.length];
	seeded = true;
	var result = soundGenerator();
	result.seed = seed;
	seeded = false;
	return result;
}
