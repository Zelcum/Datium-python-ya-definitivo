import subprocess
result = subprocess.run(['python', 'manage.py', 'migrate'], capture_output=True, text=True)
with open('migrate_error_full.txt', 'w', encoding='utf-8') as f:
    f.write("STDOUT:\n")
    f.write(result.stdout)
    f.write("\nSTDERR:\n")
    f.write(result.stderr)
