<?php
// Test upload diagnostic script
// Upload this file to your server and access it to check upload settings

echo "<h2>PHP Upload Settings Diagnostic</h2>";
echo "<table border='1' cellpadding='10'>";
echo "<tr><th>Setting</th><th>Current Value</th><th>Recommended</th></tr>";

$settings = [
    'upload_max_filesize' => '8M',
    'post_max_size' => '8M',
    'memory_limit' => '128M',
    'max_execution_time' => '300',
    'file_uploads' => '1',
];

foreach ($settings as $key => $recommended) {
    $current = ini_get($key);
    $status = ($current >= $recommended || $current === '1') ? '✓ OK' : '✗ LOW';
    echo "<tr><td>$key</td><td>$current</td><td>$recommended ($status)</td></tr>";
}

echo "</table>";

echo "<h2>Upload Directory Check</h2>";
$uploadDir = __DIR__ . '/public/uploads';
$articlesDir = $uploadDir . '/articles';

echo "<p>Upload Directory: $uploadDir</p>";
echo "<p>Exists: " . (is_dir($uploadDir) ? '✓ Yes' : '✗ No') . "</p>";
echo "<p>Writable: " . (is_writable($uploadDir) ? '✓ Yes' : '✗ No') . "</p>";

echo "<p>Articles Directory: $articlesDir</p>";
echo "<p>Exists: " . (is_dir($articlesDir) ? '✓ Yes' : '✗ No') . "</p>";
echo "<p>Writable: " . (is_writable($articlesDir) ? '✓ Yes' : '✗ No') . "</p>";

if (!is_dir($uploadDir)) {
    echo "<p style='color:red'>Creating upload directory...</p>";
    mkdir($uploadDir, 0755, true);
}

if (!is_dir($articlesDir)) {
    echo "<p style='color:red'>Creating articles directory...</p>";
    mkdir($articlesDir, 0755, true);
}

echo "<h2>Test Upload Form</h2>";
echo "<form method='post' enctype='multipart/form-data'>";
echo "<input type='file' name='test_image' accept='image/*'>";
echo "<button type='submit'>Test Upload</button>";
echo "</form>";

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['test_image'])) {
    $file = $_FILES['test_image'];
    echo "<h3>Upload Result</h3>";
    echo "<p>File name: " . htmlspecialchars($file['name']) . "</p>";
    echo "<p>File size: " . $file['size'] . " bytes</p>";
    echo "<p>File type: " . htmlspecialchars($file['type']) . "</p>";
    echo "<p>Upload error: " . $file['error'] . " (";
    
    $errors = [
        UPLOAD_ERR_OK => 'No error',
        UPLOAD_ERR_INI_SIZE => 'File exceeds upload_max_filesize',
        UPLOAD_ERR_FORM_SIZE => 'File exceeds MAX_FILE_SIZE',
        UPLOAD_ERR_PARTIAL => 'File only partially uploaded',
        UPLOAD_ERR_NO_FILE => 'No file uploaded',
        UPLOAD_ERR_NO_TMP_DIR => 'Missing temporary folder',
        UPLOAD_ERR_CANT_WRITE => 'Failed to write to disk',
        UPLOAD_ERR_EXTENSION => 'File upload stopped by extension',
    ];
    
    echo $errors[$file['error']] ?? 'Unknown error';
    echo ")</p>";
    
    if ($file['error'] === UPLOAD_ERR_OK) {
        $testPath = $articlesDir . '/test_' . time() . '.jpg';
        if (move_uploaded_file($file['tmp_name'], $testPath)) {
            echo "<p style='color:green'>✓ File successfully uploaded to: $testPath</p>";
            echo "<img src='/public/uploads/articles/" . basename($testPath) . "' style='max-width:300px'>";
        } else {
            echo "<p style='color:red'>✗ Failed to move uploaded file</p>";
        }
    }
}
?>
