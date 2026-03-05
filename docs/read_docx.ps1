Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead("c:\Users\sandw\Documents\santa-catalina\docs\santa_catalina_integracion.docx")
$entry = $zip.GetEntry("word/document.xml")
if ($entry -ne $null) {
    $stream = $entry.Open()
    $reader = New-Object System.IO.StreamReader($stream)
    $xmlText = $reader.ReadToEnd()
    $reader.Close()
    $stream.Close()
    $zip.Dispose()
    
    $xml = [xml]$xmlText
    $ns = new-object Xml.XmlNamespaceManager $xml.NameTable
    $ns.AddNamespace("w", "http://schemas.openxmlformats.org/wordprocessingml/2006/main")
    $texts = $xml.SelectNodes("//w:t", $ns)
    $fullText = ($texts | %{ $_.InnerText }) -join ""
    $fullText | Out-File "c:\Users\sandw\Documents\santa-catalina\docs\docx_text.txt" -Encoding utf8
} else {
    $zip.Dispose()
    Write-Output "Entry word/document.xml not found."
}
