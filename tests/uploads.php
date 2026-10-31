<?php
declare(strict_types=1);
require dirname(__DIR__).'/includes/uploads.php';
function check(bool $value,string $label): void {if(!$value)throw new RuntimeException($label);echo "PASS $label\n";}
$root=sys_get_temp_dir().'/accountability-upload-test-'.bin2hex(random_bytes(8));
putenv('ACCOUNTABILITY_UPLOAD_DIR='.$root);
mkdir($root,0700,true);
$file=$root.'/fixture';
file_put_contents($file,base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZioAAAAASUVORK5CYII='));
try {
 $token=str_repeat('a',64);$other=str_repeat('b',64);
 $first=store_image($file,$token);$second=store_image($file,$token);
 check($first['id']===hash_file('sha256',$file).'.png','hashed filename');
 check($first['id']===$second['id']&&count(list_images($token))===1,'deduplicated upload');
 check(count(list_images($other))===0,'isolated library');
 check(file_get_contents(image_path($token,$first['id']))===file_get_contents($file),'image byte integrity');
 delete_image($token,$first['id']);
 check(count(list_images($token))===0&&!is_file(image_path($token,$first['id'])),'deleted unused image');
 try{delete_image($token,$first['id']);throw new RuntimeException('missing image deleted');}catch(InvalidArgumentException $e){check($e->getMessage()==='Image not found.','missing image rejected');}
 $again=store_image($file,$token);
 check($again['id']===$first['id']&&count(list_images($token))===1,'reupload after delete');
 try{image_path($token,'../file.php');throw new RuntimeException('traversal accepted');}catch(InvalidArgumentException $e){check(true,'path traversal rejected');}
 file_put_contents($file,'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
 try{store_image($file,$token);throw new RuntimeException('SVG accepted');}catch(InvalidArgumentException $e){check(true,'SVG rejected');}
}finally{
 foreach(glob($root.'/*') as $p){if(is_dir($p)){foreach(glob($p.'/*') as $f)unlink($f);rmdir($p);}else unlink($p);}rmdir($root);
}
