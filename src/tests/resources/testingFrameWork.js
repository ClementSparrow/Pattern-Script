function runTest(dataarray) {
	unitTesting=true;
	levelString=dataarray[0];
	errorStrings = []
	warningStrings = []

	for (const s of errorStrings)
	{
		throw s
	}

	const inputDat = dataarray[1]
	const targetlevel = dataarray[3] || 0
	const randomseed = dataarray[4] || null

	compile(function()
		{
			let level_index = new LevelState()
			for (let i=0; i<=targetlevel; ++i)
				level_index = level_index.next() // WIP TODO: can't make that computiation until the game is compiled
			return level_index
		},
		levelString,
		randomseed
	)

	if (errorStrings.length > 0)
		return false

	while (againing)
	{
		againing = false
		processInput(processing_causes.again_frame)
	}
	
	for(const val of inputDat)
	{
		if (val === "undo") {
			execution_context.doUndo()
		} else if (val === "restart") {
			DoRestart()
		} else if (val === "tick") {
			processInput(processing_causes.autotick)
		} else {
			processInput(val)
		}
		while (againing)
		{
			againing = false
			processInput(processing_causes.again_frame)
		}
	}

	unitTesting = false
	return (level.convertToString( (dataarray[2].indexOf('=') >= 0) ? '=' : ':' ) === dataarray[2])
}

function runCompilationTest(game_string, recordedErrorStrings, recordedWarningStrings)
{
	unitTesting = true
	errorStrings = []
	warningStrings = []

	try{
		compile(null, game_string)
	} catch (error){
		console.log(error)
	}

	return error_message_equal(errorStrings, recordedErrorStrings) && error_message_equal(warningStrings, recordedWarningStrings)
}
