<?php
declare(strict_types=1);
require __DIR__ . '/includes/uploads.php';
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header('Cache-Control: no-store');
header('Content-Type: application/json; charset=utf-8');
function reply(array $body, int $status=200): never {
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_SLASHES);
    exit;
}
try {
    $action = (string)($_GET['action'] ?? '');
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $token = (string)($_SERVER['HTTP_X_LIBRARY_KEY'] ?? '');
    if ($token === '' && $action === 'image') $token = (string)($_GET['key'] ?? '');
    owner_directory($token);
    if ($action==='upload' && $method==='POST') {
        $file = $_FILES['image'] ?? null;
        if (!$file || !is_scalar($file['error'] ?? null) || $file['error'] !== UPLOAD_ERR_OK) reply(['error'=>'Upload failed. Choose an image under 8 MB and check PHP upload limits.'],400);
        if (!is_uploaded_file($file['tmp_name'])) reply(['error'=>'Invalid uploaded file.'],400);
        reply(['image'=>store_image($file['tmp_name'],$token)],201);
    }
    if ($action==='list' && $method==='GET') reply(['images'=>list_images($token)]);
    if ($action==='delete' && $method==='POST') {
        try { delete_image($token, (string)($_GET['id'] ?? '')); }
        catch (InvalidArgumentException $e) {
            if ($e->getMessage()==='Image not found.') reply(['error'=>$e->getMessage()],404);
            throw $e;
        }
        reply(['deleted'=>true]);
    }
    if ($action==='image' && $method==='GET') {
        $path = image_path($token,(string)($_GET['id'] ?? ''));
        if (!is_file($path)) reply(['error'=>'Image not found.'],404);
        $info = getimagesize($path);
        header('Content-Type: '.$info['mime']);
        header('Content-Length: '.filesize($path));
        header('Content-Disposition: inline; filename="'.basename($path).'"');
        header("Content-Security-Policy: default-src 'none'; sandbox");
        readfile($path);
        exit;
    }
    reply(['error'=>'Unknown action or unsupported method.'],405);
} catch (InvalidArgumentException $e) { reply(['error'=>$e->getMessage()],400); }
catch (Throwable $e) { error_log($e->getMessage()); reply(['error'=>'Image storage is unavailable. Check the server upload directory permissions.'],500); }
