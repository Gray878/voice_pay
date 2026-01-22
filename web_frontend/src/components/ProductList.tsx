import React from 'react';
import { Product } from '../types';

interface ProductListProps {
  products: Product[];
  selectedProduct: Product | null;
  onSelect: (product: Product) => void;
}

const ProductList: React.FC<ProductListProps> = ({ products, selectedProduct, onSelect }) => {
  return (
    <div className="product-list">
      <h2>搜索结果</h2>
      <div className="products-grid">
        {products.map((product) => (
          <div
            key={product.id}
            className={`product-card ${selectedProduct?.id === product.id ? 'selected' : ''}`}
            onClick={() => onSelect(product)}
          >
            {product.image_url && (
              <img src={product.image_url} alt={product.name} className="product-image" />
            )}
            <div className="product-info">
              <h3>{product.name}</h3>
              {product.description && <p className="product-description">{product.description}</p>}
              <div className="product-details">
                <span className="product-price">{product.price}</span>
                <span className="product-chain">{product.chain}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProductList;
