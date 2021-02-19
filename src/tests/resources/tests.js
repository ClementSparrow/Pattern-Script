

var inputVals = {0 : "UP",1: "LEFT",2:"DOWN",3:"RIGHT",4:"ACTION",tick:"TICK",undo:"UNDO",restart:"RESTART"};

function testFunction(td)
{
}

for (const [testname, td] of testdata)
{
	test(
		testname,
		function(tdat)
		{
			return function()
			{
				const [testcode, testinput, testresult] = tdat;
				const input = testinput.map( j => inputVals[j] ).join(', ');
				var errormessage =  testcode+"\n\n\nlevel: "+(tdat[4]||0)+"\n\n\ninput: "+input;
				ok(runTest(tdat),errormessage);
			};
		}(td)
	);
}




for (const [testname, td] of errormessage_testdata)
{
	test(
		"🐛"+testname, 
		function(tdat)
		{
			return function()
			{
				var testcode = tdat[0];
				var testerrors = tdat[1];
				if (tdat.length!==3){
					throw "Error/Warning message testdata has wrong number of fields, invalid. Accidentally pasted in level recording data?";
				}
				var errormessage = testcode+"\n\n\ndesired errors: [\"" + testerrors.join('", "') + '"]';
				ok(runCompilationTest(tdat), errormessage + '\n\nGot errors: ["' + errorStrings.map(stripHTMLTags).join('", "') + '"]');
			};
		}(td)
	);
}