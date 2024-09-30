@echo off

echo Start

rem バッチファイルが実行されているディレクトリに移動
cd /d %~dp0

rem Node.jsを使用してmain.jsを実行
echo Program is running, Please wait
node main_test.js

rem 実行が正常に完了したことを表示
echo Completed, please press the Enter button

rem スクリプトの終了を待つ
pause
