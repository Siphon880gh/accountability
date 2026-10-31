<?php
declare(strict_types=1);

const IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const IMAGE_MAX_PIXELS = 40000000;

function upload_root(): string {
    return getenv('ACCOUNTABILITY_UPLOAD_DIR') ?: dirname(__DIR__) . '/storage/uploads';
}
function owner_directory(string $token): string {
    if (!preg_match('/^[a-f0-9]{64}$/D', $token)) throw new InvalidArgumentException('Invalid image library key.');
    return upload_root() . '/' . hash('sha256', $token);
}
function inspect_image(string $file): array {
    $bytes = filesize($file);
    if (!$bytes || $bytes > IMAGE_MAX_BYTES) throw new InvalidArgumentException('Choose an image smaller than 8 MB.');
    $info = @getimagesize($file);
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file);
    $types = ['image/png'=>'png', 'image/jpeg'=>'jpg', 'image/gif'=>'gif', 'image/webp'=>'webp'];
    if (!$info || !isset($types[$mime]) || ($info['mime'] ?? '') !== $mime) throw new InvalidArgumentException('Use a PNG, JPEG, GIF, or WebP image.');
    if ($info[0] * $info[1] > IMAGE_MAX_PIXELS) throw new InvalidArgumentException('Image dimensions exceed 40 megapixels.');
    return ['id'=>hash_file('sha256', $file).'.'.$types[$mime], 'mime'=>$mime, 'bytes'=>$bytes, 'width'=>$info[0], 'height'=>$info[1]];
}
function store_image(string $file, string $token): array {
    $image = inspect_image($file);
    $dir = owner_directory($token);
    if (!is_dir($dir) && !mkdir($dir, 0700, true) && !is_dir($dir)) throw new RuntimeException('Image storage is not writable.');
    $path = $dir.'/'.$image['id'];
    if (!is_file($path)) {
        $temp = tempnam($dir, 'upload-');
        if ($temp === false) throw new RuntimeException('Could not prepare image storage.');
        try {
            if (!copy($file, $temp) || !chmod($temp, 0600) || !rename($temp, $path)) throw new RuntimeException('Could not save image.');
        } finally { if (is_file($temp)) unlink($temp); }
    }
    $image['createdAt'] = gmdate('c', (int) filemtime($path));
    return $image;
}
function image_path(string $token, string $id): string {
    if (!preg_match('/^[a-f0-9]{64}\.(png|jpg|gif|webp)$/D', $id)) throw new InvalidArgumentException('Invalid image identifier.');
    return owner_directory($token).'/'.$id;
}
function delete_image(string $token, string $id): void {
    $path = image_path($token, $id);
    if (!is_file($path)) throw new InvalidArgumentException('Image not found.');
    if (!unlink($path)) throw new RuntimeException('Could not delete image.');
}
function list_images(string $token): array {
    $dir = owner_directory($token);
    $images = [];
    foreach (glob($dir.'/*') ?: [] as $path) {
        if (!preg_match('/^[a-f0-9]{64}\.(png|jpg|gif|webp)$/D', basename($path))) continue;
        $info = @getimagesize($path);
        if (!$info) continue;
        $images[] = ['id'=>basename($path),'mime'=>$info['mime'],'bytes'=>filesize($path),'width'=>$info[0],'height'=>$info[1],'createdAt'=>gmdate('c',(int)filemtime($path))];
    }
    usort($images, fn($a,$b)=>strcmp($b['createdAt'],$a['createdAt']));
    return $images;
}
