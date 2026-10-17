@echo off
call "%~dp0..\scripts\dev\launch.cmd" setup %*
if not errorlevel 1 pause
