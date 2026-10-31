"""Optional integration tests using real PHP CGI multipart parsing and api.php."""
import base64, hashlib, json, pathlib, subprocess, tempfile
root = pathlib.Path(__file__).resolve().parents[1]
png = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZioAAAAASUVORK5CYII=')
with tempfile.TemporaryDirectory(prefix='accountability-api-') as directory:
    def request(query, method='GET', token='a'*64, payload=b'', content_type=''):
        data = {'query':query,'method':method,'headers':{'x-library-key':token,'content-type':content_type},'body':base64.b64encode(payload).decode(),'uploadDir':directory}
        result = subprocess.run(['python3',str(root/'tests/php_cgi_bridge.py')],input=json.dumps(data),text=True,capture_output=True,check=True)
        r=json.loads(result.stdout)
        r['decoded']=base64.b64decode(r['body'])
        return r
    def upload(data, filename='sample.png'):
        boundary='TestBoundary'
        body=(f'--{boundary}\r\nContent-Disposition: form-data; name="image"; filename="{filename}"\r\nContent-Type: image/png\r\n\r\n'.encode()+data+f'\r\n--{boundary}--\r\n'.encode())
        return request('action=upload','POST',payload=body,content_type='multipart/form-data; boundary='+boundary)
    result=upload(png)
    assert result['status']==201, result
    image=json.loads(result['decoded'])['image']
    assert image['id']==hashlib.sha256(png).hexdigest()+'.png'
    assert upload(png)['status']==201
    assert len(json.loads(request('action=list')['decoded'])['images'])==1
    assert json.loads(request('action=list',token='b'*64)['decoded'])['images']==[]
    retrieved=request('action=image&id='+image['id']+'&key='+'a'*64,token='')
    assert retrieved['status']==200 and retrieved['decoded']==png
    assert request('action=image&id='+image['id']+'&key='+'b'*64,token='')['status']==404
    assert upload(b'<?php echo "bad"; ?>','fake.png')['status']==400
    assert upload(b'<svg xmlns="http://www.w3.org/2000/svg"/>','fake.svg')['status']==400
    deleted=request('action=delete&id='+image['id'],'POST')
    assert deleted['status']==200 and json.loads(deleted['decoded'])['deleted'] is True
    assert json.loads(request('action=list')['decoded'])['images']==[]
    assert request('action=delete&id='+image['id'],'POST')['status']==404
    assert request('action=delete&id='+image['id'],'GET')['status']==405
    assert request('action=delete&id=../api.php','POST')['status']==400
    assert request('action=upload')['status']==405
    assert request('action=list',token='bad')['status']==400
    assert request('action=image&id=../api.php&key='+'a'*64,token='')['status']==400
    print('PASS: real multipart upload, hash, deduplication, list, owner isolation, binary retrieval, invalid types, methods, tokens, and traversal.')
