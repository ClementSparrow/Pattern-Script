
function newSound(instrument)
{
	const seed = instrument + 100 * ((Math.random() * 1000000) | 0)
	consolePrint(generatorNames[instrument] + ' : ' + '<span class="cm-SOUND" onclick="playSound(' + seed.toString() + ')">' + seed.toString() + '</span>',true);
	var params = generateFromSeed(seed);
	params.sample_rate = SAMPLE_RATE;
	params.bit_depth = BIT_DEPTH;
	var sound = SoundEffect.generate(params);
	sound.play();
}

function buttonPress() {
	var generatortype = 3;
	var params = generateFromSeed( document.getElementById('sounddat').value )
	params.sample_rate = SAMPLE_RATE;
	params.bit_depth = BIT_DEPTH;
	var sound = SoundEffect.generate(params);
	sound.play();
}
