# instalar-tarea.ps1 · JSpace
# Crea la tarea de Windows «JSpace publicar»: cada 15 minutos ejecuta `node scripts\publicar.mjs --cola`,
# que publica en @jspaceco_ los posts en cola cuya hora ya llegó (y no hace nada si no hay ninguno).
# Corre solo con tu sesión de Windows iniciada; no necesita la app de Claude abierta.
# El registro queda en noticias\cola.log. Para quitarla: Unregister-ScheduledTask -TaskName 'JSpace publicar'
$node = (Get-Command node).Source
$dir = $PSScriptRoot
$arg = "/c `"`"$node`" `"$dir\scripts\publicar.mjs`" --cola >> `"$dir\noticias\cola.log`" 2>&1`""
$accion = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument $arg -WorkingDirectory $dir
$inicio = (Get-Date).Date.AddMinutes([math]::Ceiling(((Get-Date) - (Get-Date).Date).TotalMinutes / 15) * 15)
$disparo = New-ScheduledTaskTrigger -Once -At $inicio -RepetitionInterval (New-TimeSpan -Minutes 15)
$ajustes = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 30) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName 'JSpace publicar' -Description "Publica en @jspaceco_ los posts en cola ($dir)" -Action $accion -Trigger $disparo -Settings $ajustes -Force | Out-Null
Start-ScheduledTask -TaskName 'JSpace publicar'
Start-Sleep -Seconds 8
Write-Host "Tarea 'JSpace publicar' creada. Proxima ejecucion:" (Get-ScheduledTaskInfo -TaskName 'JSpace publicar').NextRunTime
Get-Content "$dir\noticias\cola.log" -Tail 3
