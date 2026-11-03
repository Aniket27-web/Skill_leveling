import os
import subprocess
import time

os.makedirs("screenshots", exist_ok=True)

chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
backend_proc = subprocess.Popen(["python", "backend/dev_server.py"])
time.sleep(3)

frontend_proc = subprocess.Popen(["npx.cmd", "vite", "preview", "--port", "5173"], cwd="frontend", shell=True)
time.sleep(3)

try:
    summary_png = os.path.abspath("screenshots/summary_page.png")
    interview_png = os.path.abspath("screenshots/interview_room.png")

    # 1. Summary page
    print("Capturing summary_page.png to", summary_png)
    subprocess.run([
        chrome_path,
        "--headless",
        f"--screenshot={summary_png}",
        "--window-size=1280,1200",
        "--hide-scrollbars",
        "http://localhost:5173/summary/sample-session"
    ], check=True)

    # 2. In-progress interview page
    print("Capturing interview_room.png to", interview_png)
    subprocess.run([
        chrome_path,
        "--headless",
        f"--screenshot={interview_png}",
        "--window-size=1280,960",
        "--hide-scrollbars",
        "http://localhost:5173/interview/demo-sess"
    ], check=True)

    print("Screenshots captured successfully!")
finally:
    frontend_proc.terminate()
    backend_proc.terminate()
