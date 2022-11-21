
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
		wave: {
			type: SQUARE,
			// Duty (for square waves only, the value of the phase at which the waves goes back to zero)
			duty: 0.0,      // Square duty
			duty_ramp: 0.0, // Duty sweep (SIGNED)
		},

		// Envelope
		env: {
			attack: 0.0,   // Attack time
			sustain: 0.3,  // Sustain time
			punch: 0.0,    // Sustain punch
			decay: 0.4,    // Decay time
		},

		// Tone
		tone: {
			base: 0.3,    // Start frequency
			limit: 0.0,   // Min frequency cutoff
			ramp: 0.0,    // Slide (SIGNED)
			dramp: 0.0,   // Delta slide (SIGNED)
		},
		
		// Vibrato
		vib: {
			strength: 0.0, // Vibrato depth
			speed: 0.0,    // Vibrato speed
		},

		// Tonal change
		arp: {
			mod: 0.0,      // Change amount (SIGNED)
			speed: 0.0,    // Change speed
		},

		// Repeat
		repeat: {
			speed: 0.0, // Repeat speed
		},

		// Phaser
		phaser: {
			offset: 0.0,   // Phaser offset (SIGNED)
			ramp: 0.0,     // Phaser sweep (SIGNED)
		},

		// Low-pass filter
		lpf: {
			freq: 1.0,     // Low-pass filter cutoff
			ramp: 0.0,     // Low-pass filter cutoff sweep (SIGNED)
			resonance: 0.0,// Low-pass filter resonance
		},
		// High-pass filter
		hpf: {
			freq: 0.0,     // High-pass filter cutoff
			ramp: 0.0,     // High-pass filter cutoff sweep (SIGNED)
		},

		// Sample parameters
		sound_vol: SOUND_VOL,
		sample_rate: SAMPLE_RATE,
		bit_depth: BIT_DEPTH,
	}
}

// This var is only used in this file
var rng

// These functions are only used in the generators bellow
function frnd(range)
{
	return range * rng.uniform()
}

function rnd(max)
{
	return rng.integer(max + 1)
}


pickupCoin = function()
{
	let result = Params()
	result.wave.type = Math.floor(frnd(SHAPES.length))
	if (result.wave.type === 3)
	{
		result.wave.type = 0
	}
	result.tone.base = 0.4 + frnd(0.5)
	result.env = {
		attack: 0.0,
		sustain: frnd(0.1),
		decay: 0.1 + frnd(0.4),
		punch: 0.3 + frnd(0.3),
	}
	if (rnd(1))
	{
		result.arp.speed = 0.5 + frnd(0.2)
		const num = (frnd(7) | 1) + 1
		const den = num + (frnd(7) | 1) + 2
		result.arp.mod = (+num) / (+den)
	}
	return result
}


laserShoot = function()
{
	let result = Params()
	result.wave.type = rnd(2)
	if ( (result.wave.type === SINE) && rnd(1) )
		result.wave.type = rnd(1)
	result.wave.type = Math.floor(frnd(SHAPES.length))

	if (result.wave.type === 3)
	{
		result.wave.type = SQUARE
	}

	result.tone.base = 0.5 + frnd(0.5);
	result.tone.limit = result.tone.base - 0.2 - frnd(0.6);
	if (result.tone.limit < 0.2) result.tone.limit = 0.2;
	result.tone.ramp = -0.15 - frnd(0.2);
	if (rnd(2) === 0)
	{
		result.tone.base = 0.3 + frnd(0.6);
		result.tone.limit = frnd(0.1);
		result.tone.ramp = -0.35 - frnd(0.3);
	}
	if (rnd(1))
	{
		result.wave.duty = frnd(0.5);
		result.wave.duty_ramp = frnd(0.2);
	}
	else
	{
		result.wave.duty = 0.4 + frnd(0.5);
		result.wave.duty_ramp = -frnd(0.7);
	}
	result.env = {
		attack: 0.0,
		sustain: 0.1 + frnd(0.2),
		decay: frnd(0.4),
		punch: rnd(1) ? frnd(0.3) : result.env.punch,
	}
	if (rnd(2) === 0)
	{
		result.phaser = {
			offset: frnd(0.2),
			ramp: -frnd(0.2),
		}
	}
	if (rnd(1))
		result.hpf.freq = frnd(0.3);

	return result
}

explosion = function()
{
	let result = Params()

	if (rnd(1)) {
		result.tone.base = 0.1 + frnd(0.4);
		result.tone.ramp = -0.1 + frnd(0.4);
	} else {
		result.tone.base = 0.2 + frnd(0.7);
		result.tone.ramp = -0.2 - frnd(0.2);
	}
	result.tone.base *= result.tone.base;
	if (rnd(4) === 0)
		result.tone.ramp = 0.0;
	if (rnd(2) === 0)
		result.repeat.speed = 0.3 + frnd(0.5);
	result.env.attack = 0.0;
	result.env.sustain = 0.1 + frnd(0.3);
	result.env.decay = frnd(0.5);
	if (rnd(1) === 0)
	{
		result.phaser = {
			offset: -0.3 + frnd(0.9),
			ramp: -frnd(0.3),
		}
	}
	result.env.punch = 0.2 + frnd(0.6);
	if (rnd(1))
	{
		result.vib = {
			strength: frnd(0.7),
			speed: frnd(0.6),
		}
	}
	if (rnd(2) === 0) {
		result.arp = {
			speed: 0.6 + frnd(0.3),
			mod: 0.8 - frnd(1.6),
		}
	}
	return result
}

birdSound = function()
{
	let result = Params()

	if (frnd(10) < 1)
	{
		result.wave.type = Math.floor(frnd(SHAPES.length));
		if (result.wave.type === 3)
		{
			result.wave.type = SQUARE
		}
		result.env = {
			attack: 0.4304400932967592 + frnd(0.2) - 0.1,
			sustain: 0.15739346034252394 + frnd(0.2) - 0.1,
			punch: 0.004488201744871758 + frnd(0.2) - 0.1,
			decay: 0.07478075528212291 + frnd(0.2) - 0.1,
		}
		result.tone.base = 0.9865265720147687 + frnd(0.2) - 0.1;
		result.tone.limit = 0 + frnd(0.2) - 0.1;
		result.tone.ramp = -0.2995018224359539 + frnd(0.2) - 0.1;
		if (frnd(1.0) < 0.5)
		{
			result.tone.ramp = 0.1 + frnd(0.15);
		}
		result.tone.dramp = 0.004598608156964473 + frnd(0.1) - 0.05;
		result.vib = {
			strength: -0.2202799497929496 + frnd(0.2) - 0.1,
			speed: 0.8084998703158364 + frnd(0.2) - 0.1,
		}
		result.arp = {
			mod: 0,
			speed: 0,
		}
		result.wave.duty = -0.9031808754347107 + frnd(0.2) - 0.1;
		result.wave.duty_ramp = -0.8128699999808343 + frnd(0.2) - 0.1;
		result.repeat.speed = 0.6014860189319991 + frnd(0.2) - 0.1;
		result.phaser = {
			offset: -0.9424902314367765 + frnd(0.2) - 0.1,
			ramp: -0.1055482222272056 + frnd(0.2) - 0.1,
		}
		result.lpf = {
			freq: 0.9989765717851521 + frnd(0.2) - 0.1,
			ramp: -0.25051720626043017 + frnd(0.2) - 0.1,
			resonance: 0.32777871505494693 + frnd(0.2) - 0.1,
		}
		result.hpf = {
			freq: 0.0023548750981756753 + frnd(0.2) - 0.1,
			ramp: -0.002375673204842568 + frnd(0.2) - 0.1,
		}
		return result
	}

	if (frnd(10) < 1)
	{
		result.wave.type = Math.floor(frnd(SHAPES.length))
		if (result.wave.type === 3)
		{
			result.wave.type = SQUARE
		}
		result.env = {
			attack: 0.5277795946672003 + frnd(0.2) - 0.1,
			sustain: 0.18243733568468432 + frnd(0.2) - 0.1,
			punch: -0.020159754546840117 + frnd(0.2) - 0.1,
			decay: 0.1561353422051903 + frnd(0.2) - 0.1,
		}
		result.tone = {
			base: 0.9028855606533718 + frnd(0.2) - 0.1,
			limit: -0.008842787837148716,
			ramp: -0.1,
			dramp: -0.012891241489551925,
		}
		result.vib = {
			strength: -0.17923136138403065 + frnd(0.2) - 0.1,
			speed: 0.908263385610142 + frnd(0.2) - 0.1,
		}
		result.arp = {
			mod: 0.41690153355414894 + frnd(0.2) - 0.1,
			speed: 0.0010766233195860703 + frnd(0.2) - 0.1,
		}
		result.wave.duty = -0.8735363011184684 + frnd(0.2) - 0.1;
		result.wave.duty_ramp = -0.7397985366747507 + frnd(0.2) - 0.1;
		result.repeat.speed = 0.0591789344172107 + frnd(0.2) - 0.1;
		result.phaser = {
			offset: -0.9961184222777699 + frnd(0.2) - 0.1,
			ramp: -0.08234769395850523 + frnd(0.2) - 0.1,
		}
		result.lpf = {
			freq: 0.9412475115697335 + frnd(0.2) - 0.1,
			ramp: -0.18261358925834958 + frnd(0.2) - 0.1,
			resonance: 0.24541438107389477 + frnd(0.2) - 0.1,
		}
		result.hpf = {
			freq: -0.01831940280978611 + frnd(0.2) - 0.1,
			ramp: -0.03857383633171346 + frnd(0.2) - 0.1,
		}
		return result
	}
	
	if (frnd(10) < 1)
	{
		result.wave.type = Math.floor(frnd(SHAPES.length))

		if (result.wave.type === 3)
		{
			result.wave.type = SQUARE
		}
		result.env = {
			attack: 0.4304400932967592 + frnd(0.2) - 0.1,
			sustain: 0.15739346034252394 + frnd(0.2) - 0.1,
			punch: 0.004488201744871758 + frnd(0.2) - 0.1,
			decay: 0.07478075528212291 + frnd(0.2) - 0.1,
		}
		result.tone = {
			base: 0.9865265720147687 + frnd(0.2) - 0.1,
			limit: 0 + frnd(0.2) - 0.1,
			ramp: -0.2995018224359539 + frnd(0.2) - 0.1,
			dramp: 0.004598608156964473 + frnd(0.2) - 0.1,
		}
		result.vib = {
			strength: -0.2202799497929496 + frnd(0.2) - 0.1,
			speed: 0.8084998703158364 + frnd(0.2) - 0.1,
		}
		result.arp = {
			mod: -0.46410459213693644 + frnd(0.2) - 0.1,
			speed: -0.10955361249587248 + frnd(0.2) - 0.1,
		}
		result.wave.duty = -0.9031808754347107 + frnd(0.2) - 0.1;
		result.wave.duty_ramp = -0.8128699999808343 + frnd(0.2) - 0.1;
		result.repeat.speed = 0.7014860189319991 + frnd(0.2) - 0.1;
		result.phaser = {
			offset: -0.9424902314367765 + frnd(0.2) - 0.1,
			ramp: -0.1055482222272056 + frnd(0.2) - 0.1,
		}
		result.lpf = {
			freq: 0.9989765717851521 + frnd(0.2) - 0.1,
			ramp: -0.25051720626043017 + frnd(0.2) - 0.1,
			resonance: 0.32777871505494693 + frnd(0.2) - 0.1,
		}
		result.hpf = {
			freq: 0.0023548750981756753 + frnd(0.2) - 0.1,
			ramp: -0.002375673204842568 + frnd(0.2) - 0.1,
		}
		return result
	}

	if (frnd(5) > 1)
	{
		result.wave.type = Math.floor(frnd(SHAPES.length))

		if (result.wave.type === 3)
		{
			result.wave.type = SQUARE
		}
		if (rnd(1))
		{
			result.arp = {
				mod: 0.2697849293151393 + frnd(0.2) - 0.1,
				speed: -0.3131172257760948 + frnd(0.2) - 0.1,
			}
			result.tone.base = 0.8090588299313949 + frnd(0.2) - 0.1;
			result.wave.duty = -0.6210022920964955 + frnd(0.2) - 0.1;
			result.wave.duty_ramp = -0.00043441813553182567 + frnd(0.2) - 0.1;
			result.env = {
				attack: 0.004321877246874195 + frnd(0.2) - 0.1,
				decay: 0.1 + frnd(0.2) - 0.1,
				punch: 0.061737781504416146 + frnd(0.2) - 0.1,
				sustain: 0.4987252564798832 + frnd(0.2) - 0.1,
			}
			result.tone.dramp = 0.31700340314222614 + frnd(0.2) - 0.1;
			result.tone.limit = 0 + frnd(0.2) - 0.1;
			result.tone.ramp = -0.163380391341416 + frnd(0.2) - 0.1;
			result.hpf = {
				freq: 0.4709005021145149 + frnd(0.2) - 0.1,
				ramp: 0.6924667290539194 + frnd(0.2) - 0.1,
			}
			result.lpf = {
				freq: 0.8351398631384511 + frnd(0.2) - 0.1,
				ramp: 0.36616557192873134 + frnd(0.2) - 0.1,
				resonance: -0.08685777111664439 + frnd(0.2) - 0.1,
			}
			result.phaser = {
				offset: -0.036084571580025544 + frnd(0.2) - 0.1,
				ramp: -0.014806445085568108 + frnd(0.2) - 0.1,
			}
			result.repeat.speed = -0.8094368475518489 + frnd(0.2) - 0.1;
			result.vib = {
				speed: 0.4496665457171294 + frnd(0.2) - 0.1,
				strength: 0.23413762515532424 + frnd(0.2) - 0.1,
			}
		}
		else
		{
			result.arp = {
				mod: -0.35697118026766184 + frnd(0.2) - 0.1,
				speed: 0.3581140690559588 + frnd(0.2) - 0.1,
			}
			result.tone.base = 1.3260897696157528 + frnd(0.2) - 0.1;
			result.wave.duty = -0.30984900436710694 + frnd(0.2) - 0.1;
			result.wave.duty_ramp = -0.0014374759133411626 + frnd(0.2) - 0.1;
			result.env = {
				attack: 0.3160357835682254 + frnd(0.2) - 0.1,
				decay: 0.1 + frnd(0.2) - 0.1,
				punch: 0.24323114016870148 + frnd(0.2) - 0.1,
				sustain: 0.4 + frnd(0.2) - 0.1,
			}
			result.tone.dramp = 0.2866475886237244 + frnd(0.2) - 0.1;
			result.tone.limit = 0 + frnd(0.2) - 0.1;
			result.tone.ramp = -0.10956352368742976 + frnd(0.2) - 0.1;
			result.hpf = {
				freq: 0.20772718017889846 + frnd(0.2) - 0.1,
				ramp: 0.1564090637378835 + frnd(0.2) - 0.1,
			}
			result.lpf = {
				freq: 0.6021372770637031 + frnd(0.2) - 0.1,
				ramp: 0.24016227139979027 + frnd(0.2) - 0.1,
				resonance: -0.08787383821160144 + frnd(0.2) - 0.1,
			}
			result.phaser = {
				offset: -0.381597686151701 + frnd(0.2) - 0.1,
				ramp: -0.0002481687661373495 + frnd(0.2) - 0.1,
			}
			result.repeat.speed = 0.07812112809425686 + frnd(0.2) - 0.1;
			result.vib = {
				speed: -0.13648848579133943 + frnd(0.2) - 0.1,
				strength: 0.0018874158972302657 + frnd(0.2) - 0.1,
			}
		}
		return result
	}

	result.wave.type = Math.floor(frnd(SHAPES.length))
	if (result.wave.type === 1 || result.wave.type === 3)
	{
		result.wave.type = 2
	}
	result.tone.base = 0.85 + frnd(0.15);
	result.tone.ramp = 0.3 + frnd(0.15);
	//  result.tone.dramp = 0.3+frnd(2.0);

	result.env.attack = 0 + frnd(0.09);
	result.env.sustain = 0.2 + frnd(0.3);
	result.env.decay = 0 + frnd(0.1);

	result.wave.duty = frnd(2.0) - 1.0;
	result.wave.duty_ramp = Math.pow(frnd(2.0) - 1.0, 3.0);

	result.repeat.speed = 0.5 + frnd(0.1);

	result.phaser = {
		offset: -0.3 + frnd(0.9),
		ramp: -frnd(0.3),
	}

	result.arp = {
		speed: 0.4 + frnd(0.6),
		mod: 0.8 + frnd(0.1),
	}

	result.lpf = {
		resonance: frnd(2.0) - 1.0,
		freq: 1.0 - Math.pow(frnd(1.0), 3.0),
		ramp: Math.pow(frnd(2.0) - 1.0, 3.0),
	}
	if (result.lpf.freq < 0.1 && result.lpf.ramp < -0.05)
	{
		result.lpf.ramp = -result.lpf.ramp;
	}
	result.hpf = {
		freq: Math.pow(frnd(1.0), 5.0),
		ramp: Math.pow(frnd(2.0) - 1.0, 5.0),
	}
	return result
}


pushSound = function()
{
	let result = Params()
	result.wave.type = Math.floor(frnd(SHAPES.length))
	if (result.wave.type === 2) {
		result.wave.type++
	}
	if (result.wave.type === 0) {
		result.wave.type = NOISE
	}
	//new
	result.tone.base = 0.1 + frnd(0.4);
	result.tone.ramp = 0.05 + frnd(0.2);

	result.env.attack = 0.01 + frnd(0.09);
	result.env.sustain = 0.01 + frnd(0.09);
	result.env.decay = 0.01 + frnd(0.09);

	result.repeat.speed = 0.3 + frnd(0.5);
	result.phaser = {
		offset: -0.3 + frnd(0.9),
		ramp: -frnd(0.3),
	}
	result.arp = {
		speed: 0.6 + frnd(0.3),
		mod: 0.8 - frnd(1.6),
	}
	return result
}



powerUp = function()
{
	let result = Params()
	if (rnd(1))
		result.wave.type = SAWTOOTH;
	else
		result.wave.duty = frnd(0.6);
	result.wave.type = Math.floor(frnd(SHAPES.length));
	if (result.wave.type === 3) {
		result.wave.type = SQUARE;
	}
	if (rnd(1))
	{
		result.tone.base = 0.2 + frnd(0.3);
		result.tone.ramp = 0.1 + frnd(0.4);
		result.repeat.speed = 0.4 + frnd(0.4);
	}
	else
	{
		result.tone.base = 0.2 + frnd(0.3);
		result.tone.ramp = 0.05 + frnd(0.2);
		if (rnd(1))
		{
			result.vib = {
				strength: frnd(0.7),
				speed: frnd(0.6),
			}
		}
	}
	result.env.attack = 0.0;
	result.env.sustain = frnd(0.4);
	result.env.decay = 0.1 + frnd(0.4);

	return result
}

hitHurt = function()
{
	let result = Params()
	result.wave.type = rnd(2)
	if (result.wave.type === SINE)
		result.wave.type = NOISE
	if (result.wave.type === SQUARE)
		result.wave.duty = frnd(0.6)
	result.wave.type = Math.floor(frnd(SHAPES.length));
	result.tone.base = 0.2 + frnd(0.6);
	result.tone.ramp = -0.3 - frnd(0.4);
	result.env.attack = 0.0;
	result.env.sustain = frnd(0.1);
	result.env.decay = 0.1 + frnd(0.2);
	if (rnd(1))
		result.hpf.freq = frnd(0.3);
	return result
}


jump = function()
{
	let result = Params()
	result.wave.type = Math.floor(frnd(SHAPES.length))
	if (result.wave.type === 3)
	{
		result.wave.type = SQUARE
	}
	result.wave.duty = frnd(0.6);
	result.tone.base = 0.3 + frnd(0.3);
	result.tone.ramp = 0.1 + frnd(0.2);
	result.env.attack = 0.0;
	result.env.sustain = 0.1 + frnd(0.3);
	result.env.decay = 0.1 + frnd(0.2);
	if (rnd(1))
		result.hpf.freq = frnd(0.3);
	if (rnd(1))
		result.lpf.freq = 1.0 - frnd(0.6);
	return result
}

blipSelect = function()
{
	let result = Params();
	result.wave.type = rnd(1);
	result.wave.type = Math.floor(frnd(SHAPES.length));
	if (result.wave.type === 3) {
		result.wave.type = rnd(1);
	}
	if (result.wave.type === SQUARE)
		result.wave.duty = frnd(0.6);
	result.tone.base = 0.2 + frnd(0.4);
	result.env.attack = 0.0;
	result.env.sustain = 0.1 + frnd(0.1);
	result.env.decay = frnd(0.2);
	result.hpf.freq = 0.1;
	return result;
};

random = function()
{
	let result = Params()
	result.wave.type = Math.floor(frnd(SHAPES.length))
	result.tone.base = Math.pow(frnd(2.0) - 1.0, 2.0)
	if (rnd(1))
		result.tone.base = Math.pow(frnd(2.0) - 1.0, 3.0) + 0.5
	result.tone.limit = 0.0;
	result.tone.ramp = Math.pow(frnd(2.0) - 1.0, 5.0);
	if (result.tone.base > 0.7 && result.tone.ramp > 0.2)
		result.tone.ramp = -result.tone.ramp;
	if (result.tone.base < 0.2 && result.tone.ramp < -0.05)
		result.tone.ramp = -result.tone.ramp;
	result.tone.dramp = Math.pow(frnd(2.0) - 1.0, 3.0);
	result.wave.duty = frnd(2.0) - 1.0;
	result.wave.duty_ramp = Math.pow(frnd(2.0) - 1.0, 3.0);
	result.vib = {
		strength: Math.pow(frnd(2.0) - 1.0, 3.0),
		speed: frnd(2.0) - 1.0,
	}
	result.env = {
		attack: Math.pow(frnd(2.0) - 1.0, 3.0),
		sustain: Math.pow(frnd(2.0) - 1.0, 2.0),
		decay: frnd(2.0) - 1.0,
		punch: Math.pow(frnd(0.8), 2.0),
	}
	if (result.env.attack + result.env.sustain + result.env.decay < 0.2)
	{
		result.env.sustain += 0.2 + frnd(0.3);
		result.env.decay += 0.2 + frnd(0.3);
	}
	result.lpf = {
		resonance: frnd(2.0) - 1.0,
		freq: 1.0 - Math.pow(frnd(1.0), 3.0),
		ramp: Math.pow(frnd(2.0) - 1.0, 3.0),
	}
	if (result.lpf.freq < 0.1 && result.lpf.ramp < -0.05)
		result.lpf.ramp = -result.lpf.ramp;
	result.hpf = {
		freq: Math.pow(frnd(1.0), 5.0),
		ramp: Math.pow(frnd(2.0) - 1.0, 5.0),
	}
	result.phaser = {
		offset: Math.pow(frnd(2.0) - 1.0, 3.0),
		ramp: Math.pow(frnd(2.0) - 1.0, 3.0),
	}
	result.repeat.speed = frnd(2.0) - 1.0;
	result.arp = {
		speed: frnd(2.0) - 1.0,
		mod: frnd(2.0) - 1.0,
	}
	return result
}

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
	const seedSplit = seed.toString().split(':')
	seed = seedSplit[0]
	const volume = seedSplit[1] / 10 || 1

	rng = new RNG( (seed / 100) | 0 );
	const generatorindex = seed % 100;
	const soundGenerator = generators[generatorindex % generators.length];
	let result = soundGenerator();

	result.sound_vol = volume * SOUND_VOL
	result.seed = seed;
	return result
}
