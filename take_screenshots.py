import os
import subprocess
import time

os.makedirs("screenshots", exist_ok=True)

chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
if not os.path.exists(chrome_path):
    chrome_path = "chrome"

backend_proc = subprocess.Popen(["python", "backend/dev_server.py"])
time.sleep(3)

frontend_proc = subprocess.Popen(["npx.cmd", "vite", "preview", "--port", "5173"], cwd="frontend", shell=True)
time.sleep(3)

try:
    dashboard_png = os.path.abspath("screenshots/dashboard.png")
    interview_png = os.path.abspath("screenshots/interview_room.png")
    summary_png = os.path.abspath("screenshots/summary_page.png")

    # 1. Landing / Portal
    print("Capturing dashboard.png to", dashboard_png)
    subprocess.run([
        chrome_path,
        "--headless",
        f"--screenshot={dashboard_png}",
        "--window-size=1280,900",
        "--hide-scrollbars",
        "http://localhost:5173/"
    ], check=False)

    # 2. In-progress interview room
    print("Capturing interview_room.png to", interview_png)
    subprocess.run([
        chrome_path,
        "--headless",
        f"--screenshot={interview_png}",
        "--window-size=1280,960",
        "--hide-scrollbars",
        "http://localhost:5173/interview/demo-sess"
    ], check=False)

    # 3. Summary & debrief page
    print("Capturing summary_page.png to", summary_png)
    subprocess.run([
        chrome_path,
        "--headless",
        f"--screenshot={summary_png}",
        "--window-size=1280,1200",
        "--hide-scrollbars",
        "http://localhost:5173/summary/sample-session"
    ], check=False)

    print("Screenshots captured successfully in ./screenshots/")
finally:
    frontend_proc.terminate()
    backend_proc.terminate()
