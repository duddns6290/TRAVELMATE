import React, { useEffect, useState } from "react";
import "./ImageSlider.css";

const ImageSlider = ({ images }) => {
    const [current, setCurrent] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrent((prev) => (prev + 1) % images.length);
        }, 3000);

        return () => clearInterval(interval);
    }, [images.length]);

    const handleDotClick = (index) => {
        setCurrent(index);
    };

    return (
        <div className="slider-wrapper">
            <div className="slider-container">
                <img src={images[current]} alt={`슬라이드 ${current + 1}`} className="slider-image" />
            </div>
            <div className="slider-dots">
                {images.map((_, index) => (
                    <span
                        key={index}
                        className={`dot ${current === index ? "active" : ""}`}
                        onClick={() => handleDotClick(index)}
                    ></span>
                ))}
            </div>
        </div>
    );
};

export default ImageSlider;
