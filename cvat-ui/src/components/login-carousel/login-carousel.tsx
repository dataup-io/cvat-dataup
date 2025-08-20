import React from 'react';
import { EmblaOptionsType } from 'embla-carousel';
import Autoplay from 'embla-carousel-autoplay';
import useEmblaCarousel from 'embla-carousel-react';
import './styles.scss';

type PropType = {
    slides: string[]
    options?: EmblaOptionsType
    autoplayOptions?: { delay: number; stopOnInteraction: boolean }
};

function LoginCarousel(props: PropType): JSX.Element {
    const { slides, options, autoplayOptions } = props;
    const [emblaRef] = useEmblaCarousel(options, [Autoplay(autoplayOptions || { delay: 4500 })]);

    return (
        <section className='embla'>
            <div className='embla__viewport' ref={emblaRef}>
                <div className='embla__container'>
                    {slides.map((img, index) => (
                        <div className='embla__slide' key={index}>
                            <img className='embla__slide__img' src={img} alt={`Slide ${index + 1}`} />
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

export default LoginCarousel;
