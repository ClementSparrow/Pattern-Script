
function newSound(instrument)
{
	const seed = instrument + 100 * ((Math.random() * 1000000) | 0)
	consolePrint(generatorNames[instrument] + ' : ' + '<span class="cm-SOUND" onclick="playSound(' + seed.toString() + ')">' + seed.toString() + '</span>',true);
	const params = generateFromSeed(seed)
	SoundEffect.generate(params).play()
}

function buttonPress()
{
	const params = generateFromSeed( document.getElementById('sounddat').value )
	SoundEffect.generate(params).play()
}
