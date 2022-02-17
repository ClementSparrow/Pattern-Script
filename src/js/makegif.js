function makeGIF()
{
	var randomseed = RandomGen.seed;
	const inputDat = Array.from(inputHistory)

	unitTesting=true;
	levelString=compiledText;

	var encoder = new GIFEncoder();
	encoder.setRepeat(0); //auto-loop
	encoder.setDelay(200);
	encoder.start();

	// TODO: we should not have to recompile. Actually, we don't want to recompile. We want to use the replay the inputHistory in the same state (already compiled) than
	// when we created the inputHistory.
	compile(curlevel, levelString, randomseed)

	var gifcanvas = document.createElement('canvas');
	const [virtual_screen_w, virtual_screen_h] = screen_layout.content.get_virtual_screen_size()
	gifcanvas.width  = gifcanvas.style.width  = virtual_screen_w * screen_layout.magnification
	gifcanvas.height = gifcanvas.style.height = virtual_screen_h * screen_layout.magnification
	var gifctx = gifcanvas.getContext('2d');

	gifctx.drawImage(screen_layout.canvas, -screen_layout.margins[0], -screen_layout.margins[1]);
  	encoder.addFrame(gifctx);
	var autotimer=0;

	for(const val of inputDat)
  	{
  		var realtimeframe = false
  		switch (val)
  		{
		case 'undo':
			execution_context.doUndo()
			break
		case 'restart':
			DoRestart()
			break
		case 'tick':
			processInput(processing_causes.autotick)
			realtimeframe = true
			break
		default:
			processInput(val)
		}

		redraw()
		gifctx.drawImage(screen_layout.canvas, -screen_layout.margins[0], -screen_layout.margins[1])
		encoder.addFrame(gifctx)
		encoder.setDelay(realtimeframe ? autotickinterval : repeatinterval)
		autotimer += repeatinterval

		while (againing)
		{
			processInput(processing_causes.again_frame)
			redraw()

			encoder.setDelay(againinterval)
			gifctx.drawImage(screen_layout.canvas, -screen_layout.margins[0], -screen_layout.margins[1])
	  		encoder.addFrame(gifctx)
		}
	}

	encoder.finish();
	const data_url = 'data:image/gif;base64,'+btoa(encoder.stream().getData());
	consolePrint('<img class="generatedgif" src="'+data_url+'">');
	consolePrint('<a href="'+data_url+'" download>Download GIF</a>');
  	
	inputHistory = inputDat
	unitTesting = false
}
