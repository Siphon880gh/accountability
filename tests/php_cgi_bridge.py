"""Optional HTTP harness: execute the real api.php via PHP CGI without a socket."""
import base64, json, os, pathlib, subprocess, sys
request = json.load(sys.stdin)
root = pathlib.Path(__file__).resolve().parents[1]
env = dict(os.environ)
headers = request.get('headers', {})
body = base64.b64decode(request.get('body', ''))
env.update({
    'REDIRECT_STATUS': '200', 'GATEWAY_INTERFACE': 'CGI/1.1',
    'REQUEST_METHOD': request.get('method', 'GET'),
    'SCRIPT_FILENAME': str(root / 'api.php'), 'SCRIPT_NAME': '/api.php',
    'QUERY_STRING': request.get('query', ''), 'SERVER_PROTOCOL': 'HTTP/1.1',
    'CONTENT_LENGTH': str(len(body)), 'CONTENT_TYPE': headers.get('content-type', ''),
    'HTTP_X_LIBRARY_KEY': headers.get('x-library-key', ''),
    'ACCOUNTABILITY_UPLOAD_DIR': request.get('uploadDir', '/tmp/accountability-browser-uploads'),
})
result = subprocess.run(['php-cgi', '-d', 'upload_max_filesize=8M', '-d', 'post_max_size=10M'],input=body,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,check=True)
head, content = result.stdout.split(b'\r\n\r\n', 1)
response_headers = {}
status = 200
for line in head.decode().split('\r\n'):
    key, value = line.split(':', 1)
    if key.lower() == 'status': status = int(value.strip().split()[0])
    else: response_headers[key] = value.strip()
print(json.dumps({'status':status, 'headers':response_headers,'body':base64.b64encode(content).decode()}))
