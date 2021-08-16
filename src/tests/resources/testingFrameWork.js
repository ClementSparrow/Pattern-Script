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

	compile(["loadLevel",targetlevel], levelString, randomseed)

	if (errorStrings.length > 0)
		return false

	while (againing) {
		againing=false;
		processInput(-1);			
	}
	
	for(const val of inputDat)
	{
		if (val === "undo") {
			DoUndo(false, true)
		} else if (val === "restart") {
			DoRestart()
		} else if (val === "tick") {
			processInput(-1)
		} else {
			processInput(val)
		}
		while (againing) {
			againing=false;
			processInput(-1);			
		}
	}

	unitTesting = false
	return (convertLevelToString() === dataarray[2])
}

function runCompilationTest(game_string, recordedErrorStrings, recordedWarningStrings)
{
	unitTesting = true
	errorStrings = []
	warningStrings = []

	try{
		compile(["restart"], game_string)
	} catch (error){
		console.log(error)
	}

	return error_message_equal(errorStrings, recordedErrorStrings) && error_message_equal(warningStrings, recordedWarningStrings)
}
