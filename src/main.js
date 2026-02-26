let editor;
let pyodide;
let currentLang = "python";
let uploadedFileData = "";

function handleFileUploadKey(event) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    document.getElementById("fileInput").click();
  }
}

const recipes = {
  py_basic: `# Import necessary libraries\nimport pandas as pd\nimport io\n\ntry:\n    # Load the file stored in the WASM virtual filesystem\n    df = pd.read_csv('uploaded_data.csv')\n    \n    # Generate and print statistical summary\n    print("--- DATASET SUMMARY ---")\n    print(df.describe())\n    \n    print("\\n--- COLUMN DATA TYPES ---")\n    print(df.dtypes)\nexcept Exception as e:\n    print(f"Error: {e}. Please ensure a CSV file is uploaded.")`,

  py_viz: `# Import viz and data libraries\nimport pandas as pd\nimport matplotlib.pyplot as plt\nimport io, base64\n\ntry:\n    # Read data from the virtual 'uploaded_data.csv'\n    df = pd.read_csv('uploaded_data.csv')\n\n    # Create a plot using the first two numeric columns\n    plt.figure(figsize=(10, 6))\n    df.select_dtypes(include=['number']).iloc[:, 0:2].plot(kind='line')\n    \n    plt.title("WASM Data Chainsaw Output")\n    plt.xlabel("Index")\n    plt.ylabel("Values")\n    plt.grid(True, linestyle='--', alpha=0.7)\n\n    # Convert plot to Base64 to send it to the UI container\n    buf = io.BytesIO()\n    plt.savefig(buf, format='png', dpi=100)\n    buf.seek(0)\n    img_str = base64.b64encode(buf.read()).decode('utf-8')\n    \n    # Send signal to the JS layer to render the chart\n    print(f"##CHART##{img_str}")\n    print("Visualization generated successfully.")\nexcept Exception as e:\n    print(f"Visualization error: {e}")`,

  py_clean: `# Clean and export data back to the filesystem\nimport pandas as pd\n\ntry:\n    df = pd.read_csv('uploaded_data.csv')\n    \n    # 1. Drop rows that contain any missing values\n    df_clean = df.dropna()\n    \n    # 2. Reset the index for the new dataset\n    df_clean = df_clean.reset_index(drop=True)\n    \n    # 3. Save the cleaned data back to the virtual FS for download\n    df_clean.to_csv('uploaded_data.csv', index=False)\n    \n    print("Data cleaned! Rows remaining:", len(df_clean))\n    print("\\nPreview of cleaned data:")\n    print(df_clean.head())\nexcept Exception as e:\n    print(f"Cleaning error: {e}")`,

  pl_grep: `# Perl Regex Power: Find specific patterns\nuse strict;\nuse warnings;\n\nmy $file = 'uploaded_data.csv';\n\nif (-e $file) {\n    open(my $fh, '<', $file) or die "Could not open $file: $!";\n    print "--- SEARCH RESULTS ---\\n";\n    while (my $line = <$fh>) {\n        # Change 'error' to whatever keyword you are looking for\n        if ($line =~ /error|warning|fail/i) {\n            print "L$.: $line";\n        }\n    }\n    close($fh);\n} else {\n    print "Please upload a CSV file first.";\n}`,

  pl_transform: `# Perl Data Transformation: Manipulate CSV columns\nuse strict;\nuse warnings;\n\nmy $file = 'uploaded_data.csv';\n\nif (-e $file) {\n    open(my $in, '<', $file) or die $!;\n    open(my $out, '>', 'transformed.csv') or die $!;\n    \n    while (<$in>) {\n        chomp;\n        my @fields = split(/,/, $_);\n        \n        # EXAMPLE: Uppercase the first column and add a timestamp column\n        $fields[0] = uc($fields[0]);\n        push @fields, time();\n        \n        my $new_line = join(",", @fields);\n        print $out "$new_line\\n";\n        print "$new_line\\n" if $. <= 10; # Print first 10 rows to UI\n    }\n    \n    close($in);\n    close($out);\n    \n    # Overwrite the main file so it can be downloaded\n    rename('transformed.csv', $file);\n    print "--- SUCCESS ---\\nProcessed $. lines. Data overwritten in virtual FS.";\n} else {\n    print "No file found.";\n}`,
};

require.config({
  paths: { vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs" },
});

require(["vs/editor/editor.main"], function () {
  editor = monaco.editor.create(document.getElementById("editor-container"), {
    value: recipes.py_basic,
    language: "python",
    theme: "vs-dark",
    automaticLayout: true,
    fontSize: 14,
    minimap: { enabled: false },
  });
  initEngines();
});

async function initEngines() {
  const status = document.getElementById("status");
  try {
    pyodide = await loadPyodide();
    await pyodide.loadPackage(["pandas", "matplotlib"]);

    status.innerText = "Python Ready | Perl Ready";
    document.getElementById("runBtn").disabled = false;

    if (uploadedFileData) {
      syncFilesToWASM(uploadedFileData);
    }
  } catch (e) {
    status.innerText = "Engine Init Error";
    console.error("Pyodide Init Error:", e);
    document.getElementById("output-area").innerText =
      "FATAL ERROR: Failed to load Pyodide. Please refresh.";
  }
}

document.getElementById("fileInput").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const text = await file.text();
  uploadedFileData = text;
  document.getElementById("file-indicator").innerText = `Loaded: ${file.name}`;
  document.getElementById("downloadBtn").classList.remove("hidden");

  syncFilesToWASM(text);
  log(`File "${file.name}" sync'd to virtual filesystems.`);
});

function syncFilesToWASM(text) {
  if (pyodide && pyodide.FS) {
    pyodide.FS.writeFile("uploaded_data.csv", text);
  }
  if (window.Perl && window.Perl.FS) {
    window.Perl.FS.writeFile("uploaded_data.csv", text);
  }
}

async function downloadData() {
  let data = "";
  try {
    if (currentLang === "python") {
      data = pyodide.FS.readFile("uploaded_data.csv", { encoding: "utf8" });
    } else {
      data = Perl.FS.readFile("uploaded_data.csv", { encoding: "utf8" });
    }

    const blob = new Blob([data], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.download = "chainsaw_processed_data.csv";
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    alert(`Error reading file from virtual filesystem: ${err.message}`);
  }
}

async function runScript() {
  const code = editor.getValue();
  const output = document.getElementById("output-area");
  const viz = document.getElementById("viz-container");
  const chartImg = document.getElementById("py-chart");

  output.innerText = "Executing...\n";
  viz.classList.add("hidden");

  try {
    if (currentLang === "python") {
      pyodide.runPython(`
        import sys
        import io
        sys.stdout = io.StringIO()
      `);

      await pyodide.runPythonAsync(code);

      let stdout = pyodide.runPython("sys.stdout.getvalue()");

      if (stdout.includes("##CHART##")) {
        const parts = stdout.split("##CHART##");
        stdout = parts[0];
        chartImg.src = `data:image/png;base64,${parts[1].trim()}`;
        viz.classList.remove("hidden");
      }

      output.innerText = stdout || "Script executed (no output).";
    } else {
      if (!window.Perl) {
        output.innerText = "Perl engine not fully loaded yet.";
        return;
      }

      Perl.FS.writeFile("/tmp/output.txt", "");

      Perl.eval(`
        open(my $out_fh, '>', '/tmp/output.txt');
        select $out_fh;
        ${code}
        select STDOUT;
        close $out_fh;
      `);

      const result = Perl.FS.readFile("/tmp/output.txt", { encoding: "utf8" });
      output.innerText = result || "Script executed.";
    }
  } catch (err) {
    output.innerText = `RUNTIME ERROR:\n${err.message}`;
  }
}

function switchLang(lang) {
  currentLang = lang;
  document.getElementById("btn-python").className =
    lang === "python"
      ? "px-4 py-2 md:px-6 md:py-3 font-medium transition-all tab-active text-xs md:text-sm custom-focus"
      : "px-4 py-2 md:px-6 md:py-3 font-medium transition-all text-xs md:text-sm custom-focus";
  document.getElementById("btn-perl").className =
    lang === "perl"
      ? "px-4 py-2 md:px-6 md:py-3 font-medium transition-all tab-active text-xs md:text-sm custom-focus"
      : "px-4 py-2 md:px-6 md:py-3 font-medium transition-all text-xs md:text-sm custom-focus";

  document.getElementById("recipes-python").classList.toggle("hidden", lang !== "python");
  document.getElementById("recipes-perl").classList.toggle("hidden", lang !== "perl");

  const model = editor.getModel();
  monaco.editor.setModelLanguage(model, lang);

  if (lang === "python") {
    editor.setValue(recipes.py_basic);
  } else {
    editor.setValue(recipes.pl_grep);
  }
}

function loadRecipe(key) {
  if (recipes[key]) {
    editor.setValue(recipes[key]);
  }
}

function log(msg) {
  const output = document.getElementById("output-area");
  output.innerText += `\n[SYSTEM] ${msg}`;
}

window.handleFileUploadKey = handleFileUploadKey;
window.downloadData = downloadData;
window.runScript = runScript;
window.switchLang = switchLang;
window.loadRecipe = loadRecipe;
