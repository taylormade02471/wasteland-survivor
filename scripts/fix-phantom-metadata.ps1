$ErrorActionPreference = "Stop"
$ffmpeg = (Get-Command ffmpeg).Source
$musicRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\public\assets\nightfall\music")).Path
$cover = Join-Path $musicRoot "phantom-nightfall-files-cover-v1.jpg"
$album = "Wasteland Survivor: Nightfall Files"
$tracks = [ordered]@{
  "the-coat-beside-the-door.mp3" = "The Coat Beside the Door"
  "winter-folded-in-the-seams.mp3" = "Winter Folded in the Seams"
  "answer-back-in-flame.mp3" = "Answer Back in Flame"
  "fire-in-our-hands.mp3" = "Fire in Our Hands"
  "we-hunt-now.mp3" = "We Hunt Now"
}

foreach ($entry in $tracks.GetEnumerator()) {
  $input = Join-Path $musicRoot $entry.Key
  $temporary = Join-Path $musicRoot ("." + $entry.Key + ".metadata-fix.mp3")
  if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Force }
  & $ffmpeg -hide_banner -loglevel error -y `
    -i $input -i $cover -map 0:a:0 -map 1:v:0 -c:a copy -c:v mjpeg `
    -metadata ("title=" + $entry.Value) -metadata "artist=Phantom" `
    -metadata ("album=" + $album) -metadata "album_artist=Phantom" `
    -metadata "comment=Author: Phantom; Wasteland Survivor background music" `
    -metadata "publisher=Phantom" -metadata:s:v "title=Album cover" `
    -metadata:s:v "comment=Phantom - Wasteland Survivor: Nightfall Files" `
    -id3v2_version 3 -write_id3v1 1 -disposition:v attached_pic $temporary
  if ($LASTEXITCODE -ne 0 -or !(Test-Path -LiteralPath $temporary)) {
    throw "ffmpeg metadata update failed for $($entry.Key)"
  }
  Move-Item -LiteralPath $temporary -Destination $input -Force
  Write-Output ("updated " + $entry.Key)
}
