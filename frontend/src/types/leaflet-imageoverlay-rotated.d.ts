// Ambient types for the leaflet-imageoverlay-rotated plugin, which ships no
// types. It adds L.imageOverlay.rotated(...) — an ImageOverlay positioned by
// three corner LatLngs (topleft, topright, bottomleft) rather than a bbox.
import 'leaflet';

declare module 'leaflet' {
  interface ImageOverlayRotated extends ImageOverlay {
    reposition(topleft: LatLng, topright: LatLng, bottomleft: LatLng): void;
  }

  namespace imageOverlay {
    function rotated(
      imgSrc: string | HTMLImageElement | HTMLCanvasElement,
      topleft: LatLngExpression,
      topright: LatLngExpression,
      bottomleft: LatLngExpression,
      options?: ImageOverlayOptions,
    ): ImageOverlayRotated;
  }
}

declare module 'leaflet-imageoverlay-rotated';
