

var inputVals = {0 : 'U', 1: 'L', 2:'D', 3:'R', 4:' Action ', tick:' Tick ', undo:' Undo ', restart:' Restart '}

// tests of results of inputs
function test_module_with_inputs(testdata_list)
{
	for (const [testname, td] of testdata_list)
	{
		const [testcode, testinput, testresult] = td
		const level_num = td[3]||0
		const seed = td[4] // undefined is ok
		const input = testinput.map( j => inputVals[j] ).join('').replaceAll(/([^t\s]{5})(?=[^\s])/gu, '$1 ').replaceAll(/\s\s+/g, ' ')
		const description = "<b>level:</b> " + level_num + "<br/><b>input:</b> <span style='white-space:pre-wrap;'>" + input + '</span><br/><b>Game:</b><pre>' + testcode + '</pre>'
		test(
			testname,
			[ [testname, testcode, input, testresult, level_num, seed ], ['test name', 'game code', 'input', 'expected level state', 'level number', 'random seed'] ],
			function(tdat)
			{
				const display_content = description
				return function()
				{
					ok(
						runTest(tdat),
						((errorStrings.length > 0) ? ('<b>Got errors:</b><ul>'   +   errorStrings.map(m => '<li>' + JSON.stringify(stripHTMLTags(m)) + '</li>').join('') + '</ul>') : '') +
						((warningStrings.length > 0) ? ('<b>Got warnings:</b><ul>' + warningStrings.map(m => '<li>' + JSON.stringify(stripHTMLTags(m)) + '</li>').join('') + '</ul>') : '')
						+ display_content
					)
				};
			}(td)
		)
	}
}

QUnit.module('Game parts') // replay game parts to check the execution of rules
test_module_with_inputs(testdata)

QUnit.module('Increpare Games') // replay game parts to check the execution of rules
test_module_with_inputs(increpare_testdata)




QUnit.module('Errors and warnings') // check that they are well triggered

function test_compile(testcode, errors, warnings)
{
	return function()
	{
		const testerrors =   '<b>Expected errors:</b><ul>'   + errors.map(  m => '<li>'+JSON.stringify(m)+'</li>').join('') + '</ul>'
		const testwarnings = '<b>Expected warnings:</b><ul>' + warnings.map(m => '<li>'+JSON.stringify(m)+'</li>').join('') + '</ul>'
		ok(runCompilationTest(testcode, errors, warnings),
		   testerrors + testwarnings +
		   '<b>Got errors:</b><ul>'   +   errorStrings.map(m => '<li>' + JSON.stringify(stripHTMLTags(m)) + '</li>').join('') + '</ul>' + 
		   '<b>Got warnings:</b><ul>' + warningStrings.map(m => '<li>' + JSON.stringify(stripHTMLTags(m)) + '</li>').join('') + '</ul>' +
		   '<b>Game:</b><pre>' + testcode + '</pre>'
		)
	}
}

for (const [testname, td] of errormessage_testdata)
{
	test(
		testname, 
		[ [testname, td[0]], ['test name', 'game code'] ],
		test_compile(td[0], td[1], td[2])
	)
}


QUnit.module('Demos') // Test that demos compile without error or warning

function get_textfile(filename, callback)
{
	var fileOpenClient = new XMLHttpRequest()
	fileOpenClient.open('GET', filename)
	fileOpenClient.onreadystatechange = function()
	{
		if(fileOpenClient.readyState == 4)
		{
			callback(fileOpenClient.responseText)
		}
	}
	fileOpenClient.send()
}

get_textfile('demo_list.txt', demo_list => demo_list.split('\n').forEach(test_demo_file) )

function test_demo_file(demo_filename)
{
	if (demo_filename === 'README' || demo_filename === 'blank.txt' || demo_filename === '')
		return
	get_textfile('../demo/'+demo_filename, function(demo_text)
		{
			// const errormessage_entry = errormessage_testdata.findIndex( ([name, data]) => data[0].replace(/\s/g, '') === demo_text.replace(/\s/g, ''))
			// if (errormessage_entry >= 0)
			// 	console.log('can erase entry #'+errormessage_entry+' ('+errormessage_testdata[errormessage_entry][0]+') of error messages, as it is the same as '+demo_filename)
			test(
				demo_filename,
				[ [demo_text, demo_filename], ['game code', 'filename'] ],
				test_compile(demo_text, [], [])
			)
		})
}
