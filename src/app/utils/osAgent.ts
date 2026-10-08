
async function drawGridOnImage(base64Image: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(base64Image);
      
      ctx.drawImage(img, 0, 0);
      
      // Draw Grid
      const gridSize = 100;
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
      ctx.lineWidth = 1;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.font = '12px Arial';
      
      for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
      
      // Draw labels
      for (let x = 0; x < canvas.width; x += gridSize) {
        for (let y = 0; y < canvas.height; y += gridSize) {
           // Draw a small background for text readability
           ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
           ctx.fillRect(x + 2, y + 2, 60, 16);
           ctx.fillStyle = '#00ff00';
           ctx.fillText(`${x},${y}`, x + 5, y + 14);
        }
      }
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = base64Image;
  });
}

export async function runOSAgent(task: string, model: any, electronAPI: any, onProgress: (msg: string) => void) {
  if (!electronAPI || !electronAPI.takeScreenshot || !electronAPI.osAction) {
    onProgress("Error: OS Tools not available in this environment.");
    return;
  }
  
  if (!model || model.provider === "Internal System") {
    onProgress("Error: Please select a real Cloud Model (like Gemini 1.5 Pro or Claude 3.5 Sonnet) for OS Agent mode.");
    return;
  }

  const systemPrompt = `You are an autonomous OS Agent. You can control the computer using the provided tools.
You will receive the user's task and a screenshot of their current screen.

You must output ONLY a valid JSON object in this exact format. Do not add any markdown formatting or extra text.
{
  "thought": "I see the Photoshop icon at x:200, y:300. I will click it.",
  "tool": "left_click",
  "params": {"x": 200, "y": 300}
}

AVAILABLE TOOLS:
- mouse_move: params: {"x": number, "y": number}
- left_click: params: {}  (clicks at current mouse position)
- right_click: params: {}
- type_text: params: {"text": string}
- press_key: params: {"key": string} (e.g. "enter", "tab", "esc", "ctrl+c")
- run_shell: params: {"command": string}
- search_files: params: {"query": string, "folderPath": string} (Search the whole project directory for a keyword or regex)
- read_file: params: {"path": string} (Read contents of a file directly, completely bypassing the UI)
- write_file: params: {"path": string, "content": string} (Overwrite a file completely)
- replace_in_file: params: {"path": string, "oldText": string, "newText": string} (Replace a specific block of text in a file)
- finish: params: {"message": string} (use this when the task is complete)

Rules:
1. The screenshot has a red grid overlay with coordinates (e.g., 100,200) printed in green text at every 100px intersection.
2. Use this grid to calculate the EXACT (x, y) coordinates of the UI element you want to interact with.
3. If you need to click something, FIRST move the mouse there, THEN left_click. (Wait, you can output only ONE tool per turn).
4. Be precise and concise.`;

  onProgress("Agent started. Taking initial screenshot...");
  let maxLoops = 15;
  let loops = 0;
  
  const googleKey = localStorage.getItem('imhotep_google_api_key');
  const openRouterKey = localStorage.getItem('imhotep_or_key');

  let history: any[] = [];

  while (loops < maxLoops) {
    loops++;
    let screenshot = await electronAPI.takeScreenshot();
    if (!screenshot) {
      onProgress("Error: Failed to capture screen.");
      break;
    }
    // Add grid overlay for precision
    screenshot = await drawGridOnImage(screenshot);

    onProgress(`Thinking (Step ${loops})...`);
    
    // Construct payload
    let resData: any = null;
    try {
      if (model.provider === 'Google') {
        const base64Data = screenshot.split(',')[1];
        const payload = {
          contents: [
            ...history,
            {
              role: "user",
              parts: [
                { text: `Task: ${task}\nWhat should be the next action?` },
                { inlineData: { mimeType: "image/png", data: base64Data } }
              ]
            }
          ],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { temperature: 0.1 }
        };
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model.id}:generateContent?key=${googleKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        resData = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        // Save history for next turn
        history.push({
           role: "user",
           parts: [
             { text: `Task: ${task}\nWhat should be the next action?` },
             { inlineData: { mimeType: "image/png", data: base64Data } }
           ]
        });
        history.push({
           role: "model",
           parts: [{ text: resData }]
        });
        
      } else {
        // OpenRouter Vision Payload
        const payload = {
          model: model.id,
          messages: [
            { role: "system", content: systemPrompt },
            ...history,
            {
              role: "user",
              content: [
                { type: "text", text: `Task: ${task}\nWhat should be the next action?` },
                { type: "image_url", image_url: { url: screenshot } }
              ]
            }
          ]
        };
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${openRouterKey}` },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        resData = data.choices?.[0]?.message?.content;
        
        history.push({
           role: "user",
           content: [
             { type: "text", text: `Task: ${task}\nWhat should be the next action?` },
             { type: "image_url", image_url: { url: screenshot } }
           ]
        });
        history.push({
           role: "assistant",
           content: resData
        });
      }
      
      // Parse JSON
      const jsonStr = resData.replace(/```[a-z]*\n?/g, '').replace(/```/g, '').trim();
      const action = JSON.parse(jsonStr);
      
      onProgress(`Action: ${action.tool} - ${action.thought}`);
      
      if (action.tool === 'finish') {
        onProgress(`Agent finished: ${action.params?.message || 'Done.'}`);
        break;
      }
      
      // Execute Tool
      let toolResult = "";
      if (action.tool === 'run_shell') {
         const out = await electronAPI.runShell(action.params.command);
         toolResult = out.stdout + out.stderr;
      } else if (action.tool === 'read_file') {
         toolResult = await electronAPI.readFile(action.params.path);
      } else if (action.tool === 'write_file') {
         await electronAPI.writeFile(action.params.path, action.params.content);
         toolResult = "File written successfully.";
      } else if (action.tool === 'replace_in_file') {
         const content = await electronAPI.readFile(action.params.path);
         const newContent = content.replace(action.params.oldText, action.params.newText);
         await electronAPI.writeFile(action.params.path, newContent);
         toolResult = "Text replaced successfully.";
      } else if (action.tool === 'search_files') {
         const results = await electronAPI.searchFiles(action.params.folderPath, action.params.query);
         toolResult = JSON.stringify(results.slice(0, 20), null, 2); // Limit to 20 results to avoid context bloat
      } else {
         await electronAPI.osAction(action.tool, action.params);
         toolResult = "OS Action executed.";
         await new Promise(r => setTimeout(r, 1500));
      }
      
      // If the tool returned something (like file content), append it so the model sees it next loop
      if (toolResult) {
         if (model.provider === 'Google') {
            history.push({
               role: "user",
               parts: [{ text: `[Tool Result]:\n${toolResult.slice(0, 4000)}` }]
            });
         } else {
            history.push({
               role: "user",
               content: `[Tool Result]:\n${toolResult.slice(0, 4000)}`
            });
         }
      }
      
    } catch (e: any) {
      onProgress(`Error: ${e.message}. Retrying...`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  
  if (loops >= maxLoops) {
    onProgress("Agent stopped (reached maximum loop limit).");
  }
}
