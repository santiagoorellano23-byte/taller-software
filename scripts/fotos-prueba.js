// Solo datos ficticios para seed y pruebas; no se incluye en el paquete de ejecución.
import crypto from 'node:crypto';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
export async function fotosPrueba(cliente) {
  const clave=crypto.randomUUID(),fotos=[];
  for(const tipo of ['tablero','exterior']){
    const token=crypto.randomUUID();
    // Se distinguen las huellas; no se presentan como fotografías reales.
    const crudo=Buffer.concat([PNG,Buffer.from(`FICTICIO ${tipo} ${token}`)]);
    const r=await cliente.post(`/api/recepcion/fotos?clave=${clave}&tipo=${tipo}&token=${token}`,undefined,{crudo,idempotencia:token,cabeceras:{'Content-Type':'image/png','X-Nombre-Archivo':`ficticio-${tipo}.png`}});
    fotos.push({id:r.id,tipo,descripcion:`Imagen ficticia de prueba (${tipo}); no corresponde a un auto real.`});
  }
  return {clave,fotos,carroceria:'sin_danos',tablero:'sin_testigos',observaciones:'Datos ficticios de prueba; sin inspección de un vehículo real.',confirmado:true};
}
