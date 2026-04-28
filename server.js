require('dotenv').config();

const express = require('express');
const http = require('http');
const { Pool } = require('pg');
const cors = require('cors');
const { Server } = require('socket.io');
const nodemailer = require('nodemailer');
const QRCode = require('qrcode');
const crypto = require('crypto');
const session = require('express-session');

function horaColombia() {
  const ahora = new Date();
  ahora.setHours(ahora.getHours() - 5);
  return ahora.toTimeString().split(' ')[0];
}

function fechaColombia() {
  const ahora = new Date();
  ahora.setHours(ahora.getHours() - 5);
  return ahora.toISOString().split('T')[0];
}

const app = express();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*' },
  path: '/socket.io'
});

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT ? Number(process.env.EMAIL_PORT) : 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  logger: true,
  debug: true
});

transporter.verify()
  .then(() => console.log('âœ… SMTP verificado: listo para enviar'))
  .catch(err => console.error('âŒ FallÃ³ verificaciÃ³n SMTP:', err));

app.use(cors());
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'asistencia_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 30,
    httpOnly: true
  }
}));

app.get('/asistencia', async (req, res) => {

if (!req.session.cedula) {
  return res.send(`
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Control de Asistencia</title>
    <style>
      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        font-family: "Segoe UI", Arial, sans-serif;
        background: linear-gradient(180deg, #eef0f7 0%, #e9ecf5 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
      }

      .container {
        width: 100%;
        max-width: 520px;
      }

      .card {
        width: 100%;
        background: #ffffff;
        border-radius: 28px;
        padding: 36px 28px;
        text-align: center;
        box-shadow: 0 18px 45px rgba(31, 41, 55, 0.12);
      }

      .icon-wrap {
        width: 92px;
        height: 92px;
        margin: 0 auto 22px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 42px;
        background: linear-gradient(135deg, #d9ebff, #c6e0ff);
      }

      .title {
        margin: 0;
        font-size: 20px;
        color: #7b8194;
        font-weight: 600;
      }

      .name {
        margin: 14px 0 8px;
        font-size: 34px;
        line-height: 1.1;
        color: #1f2937;
        font-weight: 800;
      }

      .subtitle {
        margin: 0 0 24px;
        font-size: 18px;
        color: #6b7280;
      }

      .input {
        width: 100%;
        border: 1px solid #d1d5db;
        border-radius: 16px;
        padding: 16px 18px;
        font-size: 18px;
        outline: none;
        margin-bottom: 18px;
      }

      .btn {
        width: 100%;
        border: none;
        border-radius: 16px;
        padding: 16px 18px;
        font-size: 18px;
        font-weight: 700;
        color: white;
        background: linear-gradient(135deg, #2563eb, #1d4ed8);
      }

      .footer {
        margin-top: 18px;
        font-size: 15px;
        color: #8b93a7;
      }

      @media (max-width: 480px) {
        .card {
          padding: 30px 22px;
          border-radius: 24px;
        }

        .icon-wrap {
          width: 84px;
          height: 84px;
          font-size: 38px;
        }

        .name {
          font-size: 28px;
        }

        .subtitle {
          font-size: 16px;
        }
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="card">
        <div class="icon-wrap">??</div>
        <p class="title">Control de Asistencia</p>
        <h1 class="name">Identificación</h1>
        <p class="subtitle">Ingresa tu cédula para continuar</p>

        <form method="POST" action="/login-qr">
          <input class="input" type="text" name="cedula" placeholder="Cédula" required>
          <button class="btn" type="submit">Ingresar</button>
        </form>

        <div class="footer">Registro seguro del empleado</div>
      </div>
    </div>
  </body>
  </html>
  `);
}

  try {
    const cedula = req.session.cedula;

    const [empleado] = await dbPromise.query(
      'SELECT nombre, cargo FROM empleados WHERE cedula=?',
      [cedula]
    );

    const nombre = empleado[0]?.nombre || 'Empleado';
    const cargo = empleado[0]?.cargo || '';

    const [rows] = await dbPromise.query(
      `SELECT id, hora_entrada, hora_salida
       FROM asistencias
       WHERE cedula=? AND DATE(fecha)=CURDATE()
       ORDER BY id DESC LIMIT 1`,
      [cedula]
    );

    let mensaje = '';
    let color = '#28a745';

    if (rows.length === 0) {
      await dbPromise.query(
        'INSERT INTO asistencias (cedula, fecha, hora_entrada) VALUES (?, ?, ?)',
        [cedula, fechaColombia(), horaColombia()]
      );

      mensaje = 'Entrada registrada ?';
      console.log('EMITIENDO NOTIFICACION:', {
        tipo: 'ENTRADA',
        cedula,
        nombre,
        cargo,
        hora: horaColombia()
      });
      io.emit('notificacion', {
        tipo: 'ENTRADA',
        cedula,
        nombre,
        cargo,
        hora: horaColombia()
      });
    }
    else if (rows[0].hora_salida) {

      const entradaStr = rows[0].hora_entrada;
      const salidaStr = rows[0].hora_salida;

      const entrada = new Date(`1970-01-01T${entradaStr}`);
      const salida = new Date(`1970-01-01T${salidaStr}`);

      const horas = (salida - entrada) / (1000 * 60 * 60);
      const valorHora = 60000 / 9;

      let pago = horas * valorHora;

      // horas extra
      if (horas > 9) {
        const extra = (horas - 9) * valorHora * 1.5;
        pago = (9 * valorHora) + extra;
      }

      pago = Math.max(0, Math.round(pago));

      await dbPromise.query(
        'UPDATE asistencias SET pago=? WHERE id=?',
        [pago, rows[0].id]
      );

      mensaje = 'Asistencia ya registrada hoy ?';
      color = '#ffc107';
    }
    else {
      const entradaStr = rows[0].hora_entrada;
      const ahoraStr = horaColombia();

      const entrada = new Date(`1970-01-01T${entradaStr}`);
      const ahora = new Date(`1970-01-01T${ahoraStr}`);

      const minutosTranscurridos = (ahora - entrada) / (1000 * 60);

      // Cambia 5 por 30 o 60 en producción
      const minutosMinimosParaSalida = 5;

      if (minutosTranscurridos < minutosMinimosParaSalida) {
        mensaje = `Entrada ya registrada ?<br>Debes esperar al menos ${minutosMinimosParaSalida} minutos para marcar salida`;
        color = '#ffc107';
      } else {
        const salidaStr = horaColombia();
        const hoy = new Date();
        const diaSemana = hoy.getDay();

        let horaEntradaOficial = '';
        let horaSalidaOficial = '';
        let horasJornada = 0;

        // Domingo
        if (diaSemana === 0) {
          horaEntradaOficial = '09:00:00';
          horaSalidaOficial = '14:00:00';
          horasJornada = 5;
        } else {
          // Lunes a sábado
          horaEntradaOficial = '08:00:00';
          horaSalidaOficial = '17:30:00';
          horasJornada = 9.5;
        }

        const entrada = new Date(`1970-01-01T${rows[0].hora_entrada}`);
        const salida = new Date(`1970-01-01T${salidaStr}`);
        const entradaOficial = new Date(`1970-01-01T${horaEntradaOficial}`);
        const salidaOficial = new Date(`1970-01-01T${horaSalidaOficial}`);

        const valorDia = 60000;
        const valorHora = valorDia / horasJornada;

        // Llegó tarde si entró después de la hora oficial
        const llegoTarde = entrada > entradaOficial ? 1 : 0;

        // Horas trabajadas reales
        const horasTrabajadas = (salida - entrada) / (1000 * 60 * 60);

        // Extra por entrar antes
        let extraEntrada = 0;
        if (entrada < entradaOficial) {
          extraEntrada = (entradaOficial - entrada) / (1000 * 60 * 60);
        }

        // Extra por salir después
        let extraSalida = 0;
        if (salida > salidaOficial) {
          extraSalida = (salida - salidaOficial) / (1000 * 60 * 60);
        }

        const horasExtra = extraEntrada + extraSalida;

        // Descuento si sale antes de la hora oficial
        let descuento = 0;
        if (salida < salidaOficial) {
          const horasFaltantes = (salidaOficial - salida) / (1000 * 60 * 60);
          descuento = Math.round(horasFaltantes * valorHora);
        }

        // Pago base del día menos descuento
        let pago = valorDia - descuento;

        // Sumar extras al 150%
        if (horasExtra > 0) {
          pago += horasExtra * valorHora * 1.5;
        }

        pago = Math.max(0, Math.round(pago));

        await dbPromise.query(
          `UPDATE asistencias
           SET hora_salida=?, pago=?, horas_trabajadas=?, horas_extra=?, descuento=?, llego_tarde=?
           WHERE id=?`,
          [
            salidaStr,
            pago,
            Number(horasTrabajadas.toFixed(2)),
            Number(horasExtra.toFixed(2)),
            descuento,
            llegoTarde,
            rows[0].id
          ]
        );

        mensaje = 'Salida registrada ?';
        color = '#007bff';

        io.emit('notificacion', {
          tipo: 'SALIDA',
          cedula,
          nombre,
          cargo,
          hora: salidaStr
        });
      }
    }

    return res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Control de Asistencia</title>
  <style>
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;
      font-family: "Segoe UI", Arial, sans-serif;
      background: linear-gradient(180deg, #eef0f7 0%, #e9ecf5 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }

    .container {
      width: 100%;
      max-width: 520px;
    }

    .card {
      width: 100%;
      background: #ffffff;
      border-radius: 28px;
      padding: 36px 28px;
      text-align: center;
      box-shadow: 0 18px 45px rgba(31, 41, 55, 0.12);
    }

    .icon-wrap {
      width: 92px;
      height: 92px;
      margin: 0 auto 22px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 42px;
      font-weight: bold;
      background: ${
        color === '#28a745'
          ? 'linear-gradient(135deg, #dff7e7, #c7f1d5)'
          : color === '#007bff'
          ? 'linear-gradient(135deg, #d9ebff, #c6e0ff)'
          : 'linear-gradient(135deg, #fff5cf, #ffeaa6)'
      };
    }

    .title {
      margin: 0;
      font-size: 20px;
      color: #7b8194;
      font-weight: 600;
      letter-spacing: 0.3px;
    }

    .name {
      margin: 14px 0 8px;
      font-size: 34px;
      line-height: 1.1;
      color: #1f2937;
      font-weight: 800;
      text-transform: capitalize;
    }

    .role {
      margin: 0 0 24px;
      font-size: 20px;
      color: #6b7280;
      text-transform: capitalize;
    }

    .message {
      margin: 0;
      font-size: 32px;
      line-height: 1.2;
      font-weight: 800;
      color: ${color};
    }

    .time-box {
      margin-top: 28px;
      background: #f7f8fc;
      border-radius: 20px;
      padding: 18px 16px;
    }

    .time-label {
      margin: 0 0 6px;
      font-size: 16px;
      color: #8a91a6;
      font-weight: 600;
    }

    .time {
      margin: 0;
      font-size: 28px;
      font-weight: 800;
      color: #111827;
    }

    .footer {
      margin-top: 22px;
      font-size: 15px;
      color: #8b93a7;
    }

    @media (max-width: 480px) {
      body {
        padding: 18px;
      }

      .card {
        padding: 30px 22px;
        border-radius: 24px;
      }

      .icon-wrap {
        width: 84px;
        height: 84px;
        font-size: 38px;
      }

      .name {
        font-size: 28px;
      }

      .role {
        font-size: 18px;
      }

      .message {
        font-size: 26px;
      }

      .time {
        font-size: 24px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="icon-wrap">
        ${
          mensaje.toLowerCase().includes('entrada')
            ? '?'
            : mensaje.toLowerCase().includes('salida')
            ? '??'
            : '??'
        }
      </div>

      <p class="title">Control de Asistencia</p>
      <h1 class="name">${nombre}</h1>
      <p class="role">${cargo}</p>

      <p class="message">${mensaje}</p>

      <div class="time-box">
        <p class="time-label">Hora del registro</p>
        <p class="time">${new Date().toLocaleTimeString('es-CO', {
          timeZone: 'America/Bogota'
        })}</p>
      </div>

      <div class="footer">
        Registro actualizado correctamente
      </div>
    </div>
  </div>
</body>
</html>
`);

  } catch (error) {
    console.error(error);
    res.send("Error");
  }
});
app.post('/login-qr', express.urlencoded({ extended: true }), async (req, res) => {
  const { cedula } = req.body;

  try {
    const [empleado] = await dbPromise.query(
      'SELECT * FROM empleados WHERE cedula=?',
      [cedula]
    );

    if (!empleado.length) {
      return res.send("<h2 style='color:red'>Empleado no encontrado ?</h2>");
    }

    req.session.cedula = cedula;

    res.redirect('/asistencia');

  } catch (error) {
    console.error(error);
    res.send("Error en login");
  }
});

app.post('/asistencia', async (req, res) => {
  const cedula = String(req.body?.cedula || '').trim();
  if (!cedula) {
    return res.status(400).json({ error: 'Cedula requerida' });
  }

  try {
    const [empleado] = await dbPromise.query(
      'SELECT * FROM empleados WHERE cedula=?',
      [cedula]
    );

    if (empleado.length === 0) {
      return res.json({ error: 'Empleado no encontrado' });
    }

    const [asistencia] = await dbPromise.query(
      `SELECT id
       FROM asistencias
       WHERE cedula=? AND DATE(fecha)=CURDATE()
       ORDER BY id DESC
       LIMIT 1`,
      [cedula]
    );

    if (asistencia.length === 0) {
      await dbPromise.query(
        'INSERT INTO asistencias (cedula, fecha, hora_entrada) VALUES (?, ?, ?)',
        [cedula, fechaColombia(), horaColombia()]
      );

      return res.json({ mensaje: 'Entrada registrada âœ…' });
    }

    await dbPromise.query(
      'UPDATE asistencias SET hora_salida=? WHERE id=?',
      [horaColombia(), asistencia[0].id]
    );

    return res.json({ mensaje: 'Salida registrada âœ…' });
  } catch (error) {
    console.error('Error en POST /asistencia:', error);
    return res.status(500).json({ error: 'No se pudo registrar asistencia' });
  }
});

app.delete('/asistencia/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await dbPromise.query(
      'DELETE FROM asistencias WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        msg: 'Registro no encontrado',
      });
    }

    res.json({
      success: true,
      msg: 'Registro eliminado correctamente',
    });
  } catch (error) {
    console.error('Error al eliminar asistencia:', error);
    res.status(500).json({
      success: false,
      msg: 'Error al eliminar el registro',
    });
  }
});

const dbPromise = {
  async query(sql, params = []) {
    let i = 0;

    const pgSql = sql
      .replace(/\?/g, () => `$${++i}`)
      .replace(/CURDATE\(\)/g, 'CURRENT_DATE')
      .replace(/CURTIME\(\)/g, 'CURRENT_TIME')
      .replace(/DATE\(fecha\)/g, 'fecha');

    const result = await pool.query(pgSql, params);
    return [result.rows, result];
  }
};

const db = {
  query(sql, params, callback) {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }

    dbPromise.query(sql, params)
      .then(([rows, result]) => callback(null, rows, result))
      .catch(error => callback(error));
  }
};

io.on('connection', socket => {
  console.log('Admin conectado');
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.json({ success: false });
  }

  db.query(
    'SELECT * FROM usuarios WHERE username=? AND password=?',
    [username, password],
    (err, result) => {
      if (err) {
        console.error('Error MySQL:', err);
        return res.json({ success: false });
      }
      return res.json({ success: result.length > 0 });
    }
  );
});

app.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  console.log('REGISTRO RECIBIDO:', req.body);

  if (!username || !email || !password) {
    return res.json({
      success: false,
      msg: 'Campos vacíos'
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO usuarios (username, email, password)
       VALUES ($1, $2, $3)
       RETURNING id, username, email`,
      [username, email, password]
    );

    console.log('Usuario creado:', result.rows[0]);

    return res.json({
      success: true,
      msg: 'Usuario creado correctamente',
      usuario: result.rows[0]
    });

  } catch (error) {
    console.error('ERROR REAL REGISTER:', error);

    return res.status(500).json({
      success: false,
      msg: 'Error BD',
      detalle: error.message,
      code: error.code
    });
  }
});

app.post('/scan', (req, res) => {
  const { cedula } = req.body;
  if (!cedula) {
    return res.status(400).json({ mensaje: 'Cedula requerida' });
  }

  const fecha = fechaColombia();
  const hora = horaColombia();

  const query = `
    SELECT * FROM asistencias 
    WHERE cedula=? AND fecha=?
  `;

  db.query(query, [cedula, fecha], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ mensaje: 'Error al consultar asistencias' });
    }

    if (!result.length) {
      const insertQuery = `
        INSERT INTO asistencias (cedula, fecha, hora_entrada)
        VALUES (?, ?, ?)
      `;
      db.query(insertQuery, [cedula, fecha, hora], insertErr => {
        if (insertErr) {
          console.error(insertErr);
          return res.status(500).json({ mensaje: 'No se pudo guardar la entrada' });
        }

        io.emit('notificacion', {
          tipo: 'ENTRADA',
          cedula,
          hora
        });

        return res.json({ tipo: 'ENTRADA' });
      });
      return;
    }

    const updateQuery = `
      UPDATE asistencias 
      SET hora_salida=? 
      WHERE id=?
    `;
    db.query(updateQuery, [hora, result[0].id], updateErr => {
      if (updateErr) {
        console.error(updateErr);
        return res.status(500).json({ mensaje: 'No se pudo registrar la salida' });
      }

      io.emit('notificacion', {
        tipo: 'SALIDA',
        cedula,
        hora
      });

      return res.json({ tipo: 'SALIDA' });
    });
  });
});

app.get('/test', (req, res) => {
  io.emit('notificacion', {
    tipo: 'ENTRADA',
    cedula: '123456',
    hora: horaColombia()
  });

  res.send('Notificación enviada');
});

app.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    const user = await pool.query(
      'SELECT * FROM usuarios WHERE email = $1',
      [email]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({ msg: 'Usuario no encontrado' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + 3600000;

    await pool.query(
      'UPDATE usuarios SET reset_token=$1, reset_expires=$2 WHERE email=$3',
      [token, expires, email]
    );

    const link = `${process.env.APP_URL}/reset-password/${token}`;

    res.json({
      success: true,
      msg: 'Link generado',
      link: link
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Error servidor' });
  }
});

app.post('/reset-password/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const user = await pool.query(
      'SELECT * FROM usuarios WHERE reset_token=$1 AND reset_expires > $2',
      [token, Date.now()]
    );

    if (user.rows.length === 0) {
      return res.status(400).json({ msg: 'Token inválido o expirado' });
    }

    await pool.query(
      'UPDATE usuarios SET password=$1, reset_token=NULL, reset_expires=NULL WHERE reset_token=$2',
      [password, token]
    );

    res.json({
      success: true,
      msg: 'Contraseña actualizada'
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Error servidor' });
  }
});

app.get('/qr', async (req, res) => {
  try {
    const payload = JSON.stringify({ type: 'asistencia', info: 'control-compania' });
    const dataUrl = await QRCode.toDataURL(payload, { errorCorrectionLevel: 'H' });
    res.json({ dataUrl, payload });
  } catch (error) {
    console.error('Error generando QR:', error);
    res.status(500).json({ error: 'No se pudo crear el cÃ³digo QR' });
  }
});

app.get('/historial', async (req, res) => {
  try {
    const [data] = await dbPromise.query(`
      SELECT
        a.*,
        e.nombre,
        e.cargo
      FROM asistencias a
      JOIN empleados e ON a.cedula = e.cedula
      ORDER BY a.fecha DESC, a.id DESC
    `);
    res.json(data);
  } catch (error) {
    console.error('Error en /historial:', error);
    res.status(500).json({ mensaje: 'No se pudo obtener el historial' });
  }
});

app.delete('/historial', async (req, res) => {
  try {
    await dbPromise.query('DELETE FROM asistencias');
    res.json({ success: true, msg: 'Historial eliminado' });
  } catch (error) {
    console.error('Error al vaciar historial:', error);
    res.status(500).json({ success: false, msg: 'Error al vaciar historial' });
  }
});

app.get('/reporte/:cedula', async (req, res) => {
  const valorDia = 60000;
  try {
    const [data] = await dbPromise.query(
      `SELECT COUNT(*) * ? AS total
       FROM asistencias
       WHERE cedula=?`,
      [valorDia, req.params.cedula]
    );

    res.json(data);
  } catch (error) {
    console.error('Error en /reporte/:cedula:', error);
    res.status(500).json({ mensaje: 'No se pudo obtener el reporte' });
  }
});

app.get('/reportes', async (req, res) => {
  try {
    const [rows] = await dbPromise.query(`
      SELECT 
        a.cedula,
        e.nombre,
        e.cargo,
        COUNT(*) AS dias,
        COALESCE(SUM(COALESCE(a.pago, 0)), 0) AS total
      FROM asistencias a
      INNER JOIN empleados e ON a.cedula = e.cedula
      GROUP BY a.cedula, e.nombre, e.cargo
      ORDER BY a.cedula ASC
    `);

    res.json(rows);
  } catch (error) {
    console.error('Error en /reportes:', error);
    res.status(500).json({
      success: false,
      msg: 'Error al cargar reportes',
      detalle: error.message
    });
  }
});

app.get('/asistencias', (req, res) => {
  db.query('SELECT * FROM asistencias', (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ mensaje: 'Error al listar asistencias' });
    }
    res.json(result);
  });
});

app.post('/empleados', async (req, res) => {
  try {
    const { nombre, cedula, cargo, celular } = req.body;

    if (!nombre || !cedula || !cargo || !celular) {
      return res.status(400).json({ mensaje: 'Datos incompletos' });
    }

    const result = await pool.query(
      `INSERT INTO empleados (nombre, cedula, cargo, celular)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [nombre, cedula, cargo, celular]
    );

    res.json({
      success: true,
      mensaje: 'Empleado creado',
      empleado: result.rows[0]
    });

  } catch (error) {
    console.error('Error al crear empleado:', error);
    res.status(500).json({
      success: false,
      mensaje: 'No se pudo crear el empleado',
      detalle: error.message
    });
  }
});

app.get('/empleados', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM empleados ORDER BY id DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener empleados:', error);
    res.status(500).json({
      mensaje: 'Error al obtener empleados',
      detalle: error.message
    });
  }
});

app.delete('/empleados/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [empleadoRows] = await dbPromise.query(
      'SELECT cedula FROM empleados WHERE id = ?',
      [id]
    );

    if (empleadoRows.length === 0) {
      return res.status(404).json({
        success: false,
        msg: 'Empleado no encontrado',
      });
    }

    const cedula = empleadoRows[0].cedula;

    await dbPromise.query(
      'DELETE FROM asistencias WHERE cedula = ?',
      [cedula]
    );

    await dbPromise.query(
      'DELETE FROM empleados WHERE id = ?',
      [id]
    );

    res.json({
      success: true,
      msg: 'Empleado y asistencias eliminados correctamente',
    });
  } catch (error) {
    console.error('Error al eliminar empleado:', error);
    res.status(500).json({
      success: false,
      msg: 'Error al eliminar empleado',
    });
  }
});

app.get('/nomina/:cedula', (req, res) => {
  const valorDia = 60000;

  db.query(
    'SELECT COUNT(*) as dias FROM asistencias WHERE cedula=?',
    [req.params.cedula],
    (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ mensaje: 'Error al calcular nÃ³mina' });
      }
      const dias = result[0]?.dias ?? 0;
      res.json({
        dias,
        total: dias * valorDia
      });
    }
  );
});


app.get('/test-email', async (req, res) => {
  try {
    const mailOptions = {
      from: 'Control Asistencia <repararpc2024@gmail.com>',
      to: 'repararpc2024@gmail.com',
      subject: 'Prueba correo',
      text: 'Funciona correctamente ðŸš€'
    };

    console.log('Enviando correo de prueba con opciones:', mailOptions);

    const info = await transporter.sendMail(mailOptions);

    console.log('Correo enviado - info:', {
      messageId: info.messageId,
      response: info.response,
      accepted: info.accepted,
      rejected: info.rejected
    });

    res.send('Correo de prueba enviado correctamente. Revisa la consola para detalles.');
  } catch (error) {
    console.error('ERROR enviando correo de prueba:', {
      message: error.message,
      code: error.code,
      response: error.response,
      responseCode: error.responseCode,
      stack: error.stack
    });
    res.status(500).send('Error enviando correo de prueba - revisa la consola del servidor.');
  }
});
app.get('/', (req, res) => {
  res.send('Backend asistencia funcionando ✅');
});
const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
