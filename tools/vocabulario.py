# Vocabulario base de CLARIA. (lema, tipo, [sinónimos/formas alternativas])
# tipos: n=sustantivo v=verbo a=adjetivo r=adverbio p=pronombre/pregunta x=expresión
V = [
# expresiones
("hola","x",["buenas"]),("chau","x",["adiós","adios"],"adiós"),("gracias","x",[]),("por favor","x",[]),("sí","x",[]),("no","x",[]),
("buenos días","x",["buen día","buen dia","buenos dias"]),("buenas tardes","x",[]),("buenas noches","x",[]),("perdón","x",["disculpa","disculpe"]),
# pronombres / preguntas / cuantificadores
("yo","p",[]),("vos","p",["tú","usted"],"tú"),("tu","p",["tuyo","tus"]),("él","p",[]),("ella","p",[]),("nosotros","p",["nosotras"]),("ellos","p",["ellas"]),
("mi","p",["mío","mía","mis"]),("su","p",["sus"]),("quién","p",[]),("qué","p",[]),("dónde","p",[]),("cuándo","p",[]),("cómo","p",[]),("cuánto","p",["cuánta"]),("por qué","p",[]),
("todo","p",["todos","todas","toda"]),("nadie","p",[]),("esto","p",["este","esta","eso"]),
# adverbios
("aquí","r",["acá","aca","aqui"]),("allá","r",["allí","alla","alli","ahí"]),("ahora","r",[]),("después","r",["despues"]),("antes","r",[]),("siempre","r",[]),("nunca","r",[]),
("mucho","r",["muy","muchos","muchas","mucha"]),("poco","r",["pocos","pocas","poca"]),("más","r",[]),("menos","r",[]),("también","r",["tambien"]),("hoy","r",[]),("mañana","r",[]),("ayer","r",[]),("cerca","r",[]),("lejos","r",[]),
# verbos
("querer","v",[]),("necesitar","v",[]),("sacar","v",[]),("pedir","v",[]),("ir","v",[]),("venir","v",[]),("tener","v",[]),("ser","v",[]),("estar","v",[]),("hacer","v",[]),("dar","v",[]),
("ver","v",[]),("mirar","v",[]),("escuchar","v",[]),("hablar","v",[]),("decir","v",[]),("leer","v",[]),("escribir","v",[]),("comer","v",[]),("beber","v",["tomar"]),("dormir","v",[]),("jugar","v",[]),
("aprender","v",[]),("enseñar","v",[]),("estudiar","v",[]),("trabajar","v",[]),("ayudar","v",[]),("saber","v",[]),("poder","v",[]),("entender","v",["comprender"]),("preguntar","v",[]),("responder","v",[]),
("llevar","v",[]),("traer","v",[]),("esperar","v",[]),("comprar","v",[]),("pagar","v",[]),("abrir","v",[]),("cerrar","v",[]),("llamar","v",[]),("firmar","v",[]),("cambiar","v",[]),("buscar","v",[]),("encontrar","v",[]),
("usar","v",[]),("guardar","v",[]),("sentir","v",[]),("vivir","v",[]),("caminar","v",[]),("lavar","v",[]),("cantar","v",[]),("dibujar","v",[]),("pintar","v",[]),("cuidar","v",[]),("gustar","v",[]),("amar","v",[]),
("entrar","v",[]),("salir","v",[]),("volver","v",[]),("empezar","v",["comenzar"]),("terminar","v",[]),("elegir","v",[]),("copiar","v",[]),("enviar","v",["mandar"]),("recibir","v",[]),("completar","v",[]),
("regalar","v",[]),("abrazar","v",[]),("cocinar","v",[]),("descansar","v",[]),("compartir","v",[]),("respetar","v",[]),("participar","v",[]),("contar","v",[]),("sentarse","v",[],"sentar"),("pensar","v",[]),("conocer","v",[]),
# sustantivos
("agua","n",[]),("pan","n",[]),("comida","n",[]),("leche","n",[]),("manzana","n",[]),("hambre","n",[]),("sed","n",[]),("baño","n",["sanitario"]),("casa","n",[]),("escuela","n",[]),("aula","n",["salón"]),
("libro","n",[]),("cuaderno","n",[]),("lápiz","n",["lapiz"]),("mochila","n",[]),("mesa","n",[]),("silla","n",[]),("puerta","n",[]),("ventana","n",[]),("hospital","n",[]),("salud","n",[]),("farmacia","n",[]),
("médico","n",["doctor","doctora","médica","medico"]),("medicina","n",["remedio"]),("turno","n",[]),("cita","n",[]),("documento","n",["documentos"]),("DNI","n",["dni"]),("certificado","n",[]),("discapacidad","n",[]),
("trámite","n",["tramite","trámites","tramites"]),("oficina","n",[]),("formulario","n",[]),("foto","n",["fotografía"]),("papel","n",[]),("teléfono","n",["telefono","celular"]),("computadora","n",["compu","ordenador"]),
("internet","n",[]),("correo","n",[]),("dinero","n",["plata"]),("tiempo","n",[]),("hora","n",[]),("día","n",["dia","días","dias"]),("fecha","n",[]),("semana","n",[]),("mes","n",[]),("año","n",["ano","años"]),
("lugar","n",[]),("dirección","n",["direccion","domicilio"]),("nombre","n",[]),("edad","n",[]),("calle","n",[]),("ciudad","n",[]),("pueblo","n",[]),("río","n",["rio"]),("árbol","n",["arbol"]),("sol","n",[]),("lluvia","n",[]),
("animal","n",[]),("perro","n",[]),("gato","n",[]),("flor","n",[]),("amor","n",[]),("familia","n",[]),("mamá","n",["mama","madre"]),("papá","n",["papa","padre"]),("hijo","n",["hija","hijos","hijas"]),
("abuelo","n",[]),("abuela","n",[]),("hermano","n",["hermana","hermanos","hermanas"]),("amigo","n",["amiga","amigos","amigas"]),("compañero","n",["compañera","compañeros","compañeras"]),
("maestro","n",["maestra","docente","profe","profesor","profesora","seño"]),("persona","n",["personas","gente"]),("niño","n",["nino","niños","ninos","pibe"]),("niña","n",["nina","niñas","ninas","piba"]),
("hombre","n",["hombres"]),("mujer","n",["mujeres"]),("bebé","n",["bebe"]),("información","n",["informacion"]),("pregunta","n",[]),("problema","n",[]),("dolor","n",[]),
("juego","n",["juegos"]),("música","n",["musica"]),("tarea","n",[]),("examen","n",[]),("clase","n",[]),("recreo","n",[]),("cumpleaños","n",[]),("regalo","n",[]),("fiesta","n",[]),
("color","n",[]),("número","n",["numero"]),("palabra","n",[]),("cuento","n",[]),("historia","n",[]),("silencio","n",[]),("miedo","n",[]),("alegría","n",["alegria"]),
("derechos","n",["derecho"]),("colectivo","n",["autobús","bondi","micro"]),("auto","n",["coche","carro"]),("banco","n",[]),("policía","n",["policia"]),("pizarra","n",["pizarrón"]),
# adjetivos
("feliz","a",["contento","contenta","alegre"]),("triste","a",[]),("enojado","a",["enojada","enfadado","enfadada"],"enfadado"),("cansado","a",["cansada"]),("enfermo","a",["enferma"]),("bueno","a",["buena"]),("malo","a",["mala"]),
("grande","a",["grandes"]),("pequeño","a",["pequeña","chico","chica"]),("nuevo","a",["nueva"]),("viejo","a",["vieja"]),("fácil","a",["facil"]),("difícil","a",["dificil"]),
("rápido","a",["rapido","rápida"]),("lento","a",["lenta"]),("igual","a",[]),("diferente","a",["distinto","distinta"]),("listo","a",["lista"]),("importante","a",[]),("gratis","a",["gratuito","gratuita"]),
("valiente","a",[]),("lindo","a",["linda","bonito","bonita"]),("frío","a",["frio","fría"]),("caliente","a",[]),("limpio","a",["limpia"]),("sucio","a",["sucia"]),("abierto","a",["abierta"]),("cerrado","a",["cerrada"]),
# palabras funcionales con posible pictograma
("para","r",[]),("con","r",[]),("sin","r",[]),("en","r",[]),
]
