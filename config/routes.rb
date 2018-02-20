Rails.application.routes.draw do
  devise_for :admins, skip: :all
  devise_for :boys, skip: [:sessions]
  devise_for :girls, skip: [:sessions]
  devise_for :users, skip: :all
  as :user do
    get 'login', to: 'devise/sessions#new', as: :new_user_session
    post 'login', to: 'devise/sessions#create', as: :user_session
    delete 'logout', to: 'devise/sessions#destroy', as: :destroy_user_session
  end
  as :boy do
    get 'login', to: 'devise/sessions#new', as: :new_boy_session
    post 'login', to: 'devise/sessions#create', as: :boy_session
    delete 'logout', to: 'devise/sessions#destroy', as: :destroy_boy_session
  end
  as :girl do
    get 'login', to: 'devise/sessions#new', as: :new_girl_session
    post 'login', to: 'devise/sessions#create', as: :girl_session
    delete 'logout', to: 'devise/sessions#destroy', as: :destroy_girl_session
  end
  get 'welcome/index'
  get 'main' => 'logged#index'
  get 'main_boy' => 'main_boy#index'
  get 'main_girl' => 'main_girl#index'
  get 'main_admin' => 'main_admin#index'
  get 'conversation' => 'conversation#index'
  get 'conversations/:id' => 'conversations#show'
  resources :messages
  root 'welcome#index'
end
